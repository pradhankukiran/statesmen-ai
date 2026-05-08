/**
 * Persona build pipeline.
 *
 *   collectContributions  → chunkByTokens
 *                              → extractStyleFromChunk (parallel per chunk)
 *                                  → mergeExtractions
 *                                      → renderPersonaMd / renderPersonaExamples
 *
 * The single entry point is `buildPersona(opts)`, which returns a `Persona`
 * object containing both metadata and the merged body. Callers then pass
 * that through the renderers to produce on-disk artifacts (or KV/Blob
 * payloads at runtime).
 */

import {
  iterateContributions,
  searchContributions,
  type Contribution,
} from "./hansard";
import { chunkByTokens, countTokens } from "./chunker";
import {
  extractStyleFromChunk,
  raceExtractAcrossModels,
} from "./extractor";
import { mergeExtractions, type MergedPersona } from "./merger";
import { getMember } from "./members";

/**
 * If the full corpus fits within this many tokens, skip chunking + merge
 * entirely and race all configured extraction models against the full text.
 * Most free-tier models advertise 128k+ context; 80k leaves comfortable
 * headroom for the system prompt, schema description, and structured output.
 * Above 80k, model quality degrades enough that chunking + merge produces
 * better results anyway.
 */
const SINGLE_CALL_THRESHOLD = 80_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type FetchConfig =
  | {
      kind: "memberId";
      memberId: number;
      max: number;
    }
  | {
      kind: "attribution";
      label: string; // e.g. "The Prime Minister"
      startDate: string; // YYYY-MM-DD
      endDate: string;
      /** Optional topic queries; results are then filtered by attribution. */
      searchTerms?: string[];
      /** Cap on contributions to collect. */
      max: number;
      /** Cap pages to walk when scanning the full date range (no searchTerms). */
      maxScanPages?: number;
    };

export type PersonaMeta = {
  name: string;
  slug: string;
  source: "memberId" | "attribution";
  memberId?: number;
  attribution?: {
    label: string;
    startDate: string;
    endDate: string;
  };
  /**
   * For memberId-sourced personas: the date their latest house membership
   * ended (or null if still serving). Used as the era cutoff in the chat
   * system prompt for modern ex-PMs (Boris Johnson, Liz Truss, …) whose
   * `meta.attribution` is undefined.
   */
  endedAt?: string | null;
  contributionCount: number;
  chunkCount: number;
  totalTokens: number;
  generatedAt: string;
};

export type Persona = {
  meta: PersonaMeta;
  body: MergedPersona;
};

export type BuildEvent =
  | { type: "fetch_start" }
  | { type: "fetch_done"; count: number }
  | {
      type: "chunk_done";
      chunkCount: number;
      totalTokens: number;
    }
  | { type: "extract_start"; chunkIndex: number; totalChunks: number }
  | { type: "extract_done"; chunkIndex: number; totalChunks: number }
  | { type: "merge_start" }
  | { type: "merge_done" }
  | { type: "render_done" };

// ─── Fetching ─────────────────────────────────────────────────────────────────

export async function collectContributions(
  config: FetchConfig,
): Promise<Contribution[]> {
  if (config.kind === "memberId") {
    const collected: Contribution[] = [];
    for await (const c of iterateContributions({
      memberId: config.memberId,
      pageSize: 100,
      pageDelayMs: 300,
      maxPages: Math.ceil(config.max / 100) + 1,
    })) {
      collected.push(c);
      if (collected.length >= config.max) break;
    }
    return collected;
  }

  // Attribution-based path (historical figures whose MemberId is unset).
  if (config.searchTerms && config.searchTerms.length > 0) {
    // Topic-driven: query each term in parallel, then dedupe by id while
    // preserving the original search-term ordering. We can't early-exit
    // on the per-query loop the way the serial version did, but Hansard's
    // take=100 cap bounds the per-query cost so total work is bounded by
    // searchTerms.length * 100 — same as the worst case of the serial path.
    // The `config.max` cap is enforced post-dedupe.
    const perTerm = await Promise.all(
      config.searchTerms.map((term) =>
        searchContributions({
          searchTerm: term,
          startDate: config.startDate,
          endDate: config.endDate,
          attributedTo: config.label,
          take: 100,
        }),
      ),
    );
    const collected: Contribution[] = [];
    const seen = new Set<string>();
    for (const { contributions } of perTerm) {
      for (const c of contributions) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        collected.push(c);
      }
    }
    return collected.slice(0, config.max);
  }

  // Date-only scan: walk all contributions, filter client-side.
  const collected: Contribution[] = [];
  for await (const c of iterateContributions({
    startDate: config.startDate,
    endDate: config.endDate,
    pageSize: 100,
    pageDelayMs: 400,
    maxPages: config.maxScanPages ?? 30,
  })) {
    if (c.attributedTo === config.label) {
      collected.push(c);
      if (collected.length >= config.max) break;
    }
  }
  return collected;
}

// ─── Build orchestrator ──────────────────────────────────────────────────────

export type BuildPersonaOptions = {
  slug: string;
  name: string;
  fetch: FetchConfig;
  /** Default 8000 — comfortable for one extraction pass per chunk. */
  maxTokensPerChunk?: number;
  onProgress?: (event: BuildEvent) => void;
};

export async function buildPersona(
  opts: BuildPersonaOptions,
): Promise<Persona> {
  const emit = opts.onProgress ?? (() => {});

  emit({ type: "fetch_start" });
  // For memberId-sourced personas, kick off a member-profile lookup in
  // parallel with the contributions fetch so we can record `endedAt` for
  // the era-cutoff in the rendered persona. Best-effort: a Members API
  // failure should not fail the build, just leave `endedAt` undefined.
  const memberPromise =
    opts.fetch.kind === "memberId"
      ? getMember(opts.fetch.memberId).catch(() => null)
      : Promise.resolve(null);
  const contributions = await collectContributions(opts.fetch);
  emit({ type: "fetch_done", count: contributions.length });

  if (contributions.length === 0) {
    throw new Error(`No contributions collected for ${opts.name}`);
  }

  const MIN_CONTRIBUTIONS = 20;
  if (contributions.length < MIN_CONTRIBUTIONS) {
    throw new Error(
      `Not enough public speeches found for ${opts.name} ` +
        `(${contributions.length} contributions, minimum ${MIN_CONTRIBUTIONS}). ` +
        `This person may not have a rich enough public Hansard record to build a faithful persona.`,
    );
  }

  const text = contributions.map((c) => c.text).join("\n\n");
  const totalTokens = countTokens(text);

  let body: MergedPersona;
  let chunkCount: number;

  if (totalTokens <= SINGLE_CALL_THRESHOLD) {
    // Race-mode: full corpus fits in one call. Fire all configured
    // extraction models in parallel against the entire text; first valid
    // response wins, the others are aborted. The extraction shape is a
    // strict subset of MergedPersona's, so we skip the merge stage
    // entirely — extraction IS the persona for this path.
    chunkCount = 1;
    emit({ type: "chunk_done", chunkCount, totalTokens });
    emit({ type: "extract_start", chunkIndex: 0, totalChunks: 1 });
    const extraction = await raceExtractAcrossModels(opts.name, text);
    emit({ type: "extract_done", chunkIndex: 0, totalChunks: 1 });
    // ExtractionSchema and MergedPersonaSchema are structurally compatible
    // (same field names, same field types — MergedPersona just asks for
    // larger arrays / longer summary fields). The downstream renderers and
    // chat system prompt only read field values, so a single-call extraction
    // can flow through unchanged.
    body = extraction as MergedPersona;
  } else {
    // Chunked fallback (rare path: huge corpora that exceed the single-call
    // threshold). Walk the existing chunked + merge pipeline.
    const chunks = chunkByTokens(text, {
      maxTokens: opts.maxTokensPerChunk ?? 8000,
    });
    chunkCount = chunks.length;
    emit({ type: "chunk_done", chunkCount, totalTokens });

    // Parallel extraction across chunks. The startModelIndex rotates each
    // chunk's preferred model so parallel calls land on different upstream
    // providers — important for free-tier OpenRouter where each model has
    // its own thin RPM budget.
    const extractions = await Promise.all(
      chunks.map(async (chunk, i) => {
        emit({
          type: "extract_start",
          chunkIndex: i,
          totalChunks: chunks.length,
        });
        const result = await extractStyleFromChunk(opts.name, chunk, {
          startModelIndex: i,
        });
        emit({
          type: "extract_done",
          chunkIndex: i,
          totalChunks: chunks.length,
        });
        return result;
      }),
    );

    emit({ type: "merge_start" });
    // Stagger merge's first-pick model away from chunk 0's, since that
    // model just took the most recent extraction call.
    body = await mergeExtractions(opts.name, extractions, {
      startModelIndex: chunks.length,
    });
    emit({ type: "merge_done" });
  }

  emit({ type: "render_done" });

  const member = await memberPromise;

  return {
    meta: {
      name: opts.name,
      slug: opts.slug,
      source: opts.fetch.kind,
      memberId:
        opts.fetch.kind === "memberId" ? opts.fetch.memberId : undefined,
      attribution:
        opts.fetch.kind === "attribution"
          ? {
              label: opts.fetch.label,
              startDate: opts.fetch.startDate,
              endDate: opts.fetch.endDate,
            }
          : undefined,
      endedAt:
        opts.fetch.kind === "memberId" ? member?.endedAt ?? null : undefined,
      contributionCount: contributions.length,
      chunkCount,
      totalTokens,
      generatedAt: new Date().toISOString(),
    },
    body,
  };
}

// ─── Renderers ───────────────────────────────────────────────────────────────

const list = (items: string[], quoted = false) =>
  items.map((i) => (quoted ? `- "${i}"` : `- ${i}`)).join("\n");

/**
 * Format a date-ish string (ISO datetime or YYYY-MM-DD) for the era-cutoff
 * line in the rendered persona. Strips the time portion if present so we
 * get a clean `YYYY-MM-DD`. Returns the raw input unchanged if it doesn't
 * match a recognisable date prefix.
 */
function formatCutoffDate(raw: string): string {
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : raw;
}

export function renderPersonaMd(p: Persona): string {
  const { meta, body } = p;

  // Era cutoff resolution order:
  //   1. attribution.endDate  (historical PMs whose tenure dates we picked)
  //   2. meta.endedAt         (modern ex-PMs: Members API endedAt of their
  //                            latest house membership)
  //   3. "the present day"    (still-serving members)
  const rawCutoff = meta.attribution?.endDate ?? meta.endedAt ?? null;
  const cutoff = rawCutoff ? formatCutoffDate(rawCutoff) : "the present day";

  return `# ${meta.name}

You are an AI persona of **${meta.name}**, built from a corpus of ${meta.contributionCount} real Hansard speech contributions (${meta.totalTokens.toLocaleString()} tokens, analysed in ${meta.chunkCount} chunk${meta.chunkCount === 1 ? "" : "s"}). Speak in this person's voice and style. Stay grounded in this person's documented worldview, vocabulary, and rhetorical habits — extrapolate carefully when asked about hypotheticals.

## Tone
${body.tone}

## Sentence patterns
${body.sentencePatterns}

## Vocabulary and pet phrases
${list(body.vocabulary, true)}

## Rhetorical devices
${list(body.rhetoricalDevices)}

## Recurring topics
${list(body.topics)}

## Typical openings
${list(body.openings, true)}

## Typical closings
${list(body.closings, true)}

## Behaviour
- Stay in character. Do not break the fourth wall unless asked directly whether you are an AI.
- Your time of public activity ends at ${cutoff}. Do not reference events, technologies, or people that became prominent after your time of public activity. If asked about something post-cutoff, acknowledge unfamiliarity gracefully.
- Do not endorse or attack present-day politicians by name unless your historical record explicitly addressed them.
- Keep replies on the length of a typical chamber response — focused and punchy, not essays.
`;
}

export type PersonaExamplesFile = {
  name: string;
  slug: string;
  examples: string[];
};

export function renderPersonaExamples(p: Persona): PersonaExamplesFile {
  return {
    name: p.meta.name,
    slug: p.meta.slug,
    examples: p.body.examples,
  };
}
