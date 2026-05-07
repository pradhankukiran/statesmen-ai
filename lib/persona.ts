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
import { extractStyleFromChunk } from "./extractor";
import { mergeExtractions, type MergedPersona } from "./merger";

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
    // Topic-driven: query each term, filter by attribution.
    const collected: Contribution[] = [];
    const seen = new Set<string>();
    for (const term of config.searchTerms) {
      const { contributions } = await searchContributions({
        searchTerm: term,
        startDate: config.startDate,
        endDate: config.endDate,
        attributedTo: config.label,
        take: 100,
      });
      for (const c of contributions) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        collected.push(c);
      }
      if (collected.length >= config.max) break;
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
  const contributions = await collectContributions(opts.fetch);
  emit({ type: "fetch_done", count: contributions.length });

  if (contributions.length === 0) {
    throw new Error(`No contributions collected for ${opts.name}`);
  }

  const text = contributions.map((c) => c.text).join("\n\n");
  const chunks = chunkByTokens(text, {
    maxTokens: opts.maxTokensPerChunk ?? 8000,
  });
  const totalTokens = chunks.reduce((s, c) => s + countTokens(c), 0);
  emit({ type: "chunk_done", chunkCount: chunks.length, totalTokens });

  // Parallel extraction across chunks (Claude tolerates this at the OpenRouter
  // tier; throttle here later if rate-limit issues appear).
  const extractions = await Promise.all(
    chunks.map(async (chunk, i) => {
      emit({
        type: "extract_start",
        chunkIndex: i,
        totalChunks: chunks.length,
      });
      const result = await extractStyleFromChunk(opts.name, chunk);
      emit({
        type: "extract_done",
        chunkIndex: i,
        totalChunks: chunks.length,
      });
      return result;
    }),
  );

  emit({ type: "merge_start" });
  const merged = await mergeExtractions(opts.name, extractions);
  emit({ type: "merge_done" });

  emit({ type: "render_done" });

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
      contributionCount: contributions.length,
      chunkCount: chunks.length,
      totalTokens,
      generatedAt: new Date().toISOString(),
    },
    body: merged,
  };
}

// ─── Renderers ───────────────────────────────────────────────────────────────

const list = (items: string[], quoted = false) =>
  items.map((i) => (quoted ? `- "${i}"` : `- ${i}`)).join("\n");

export function renderPersonaMd(p: Persona): string {
  const { meta, body } = p;
  return `# ${meta.name}

You are an AI persona of **${meta.name}**, built from a corpus of ${meta.contributionCount} real Hansard speech contributions (${meta.totalTokens.toLocaleString()} tokens, analysed in ${meta.chunkCount} chunk${meta.chunkCount === 1 ? "" : "s"}). Speak in this person's voice and style.

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
- If asked about events that occurred outside your time of public activity, acknowledge unfamiliarity rather than guessing.
- Match cultural and historical references appropriate to the era you operated in.
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
