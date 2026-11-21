import { z } from "zod";

const BASE = "https://hansard-api.parliament.uk";

// ─── Raw API schemas ───────────────────────────────────────────────────────────

const ContributionRawSchema = z.object({
  ContributionExtId: z.string(),
  ItemId: z.number().nullish(),
  MemberId: z.number().nullable(), // -1, real id, or null for historical/unattributed
  MemberName: z.string().nullish(),
  AttributedTo: z.string().nullable(),
  ContributionText: z.string().nullish(),
  ContributionTextFull: z.string().nullish(),
  SittingDate: z.string(),
  DebateSection: z.string().nullish(),
  DebateSectionExtId: z.string().nullish(),
  Section: z.string().nullish(),
  House: z.string(),
  Timecode: z.string().nullish(),
  HRSTag: z.string().nullish(),
});

const SearchResponseSchema = z.object({
  TotalResultCount: z.number().nullish(),
  SpokenResultCount: z.number().nullish(),
  WrittenResultCount: z.number().nullish(),
  CorrectionsResultCount: z.number().nullish(),
  DivisionsResultCount: z.number().nullish(),
  Results: z.array(ContributionRawSchema),
});

// ─── Public types (slim) ──────────────────────────────────────────────────────

export type Contribution = {
  id: string;
  memberId: number; // -1 for historical
  memberName: string | null;
  attributedTo: string;
  date: string; // ISO date string
  text: string; // cleaned plain text
  debateSection: string | null;
  house: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripXml(s: string): string {
  // Convert block-level / paragraph-style tags to `\n\n` BEFORE removing
  // anything else, so the downstream chunker (which splits on \n\s*\n) has
  // real paragraph boundaries to work with.
  //
  // Hansard's actual markup (verified against the live API) is small and
  // predictable: <p></p> for paragraph breaks, <blockquote>/<q> wrapping
  // long quotations, <em> for emphasis, <span class="column-number"> for
  // page-column markers, occasionally <sup> and the spec-mentioned <br>
  // variants. Treat the block-ish ones as paragraph breaks; let everything
  // else fall through to the generic tag stripper as inline.
  const withParagraphBreaks = s
    .replace(/<\/?p\s*\/?>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n\n")
    .replace(/<\/?blockquote\s*\/?>/gi, "\n\n");

  return (
    withParagraphBreaks
      // Drop all remaining tags (inline: em, q, span, sup, …).
      .replace(/<[^>]+>/g, " ")
      // Collapse runs of spaces/tabs but preserve newlines.
      .replace(/[ \t]+/g, " ")
      // Trim spaces around newlines so blank-line detection is robust.
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      // Collapse 3+ consecutive newlines down to a single \n\n boundary.
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Remove chamber stage directions that are not the speaker's own words:
 * "[Interruption.]", "[Laughter.]", "[Hon. Members: “No!”]".
 */
function stripStageDirections(s: string): string {
  return s
    .replace(/\[\s*(?:Interruption|Laughter)\s*\.?\s*\]/gi, "")
    .replace(/\[\s*Hon\. Members?:[^\]]*\]/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function toContribution(r: z.infer<typeof ContributionRawSchema>): Contribution {
  // Prefer the full text. `ContributionText` is a search preview that the API
  // cuts off at ~255 characters (verified live: 74 of 100 sampled speeches
  // were longer in `ContributionTextFull`). Fall back to the preview only
  // when the full field is empty.
  const full = stripXml(r.ContributionTextFull ?? "");
  const text = stripStageDirections(
    full.length > 0 ? full : (r.ContributionText ?? "").trim(),
  );
  return {
    id: r.ContributionExtId,
    memberId: r.MemberId ?? -1,
    memberName: r.MemberName ?? null,
    attributedTo: r.AttributedTo ?? "",
    date: r.SittingDate,
    text,
    debateSection: r.DebateSection ?? null,
    house: r.House,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type SearchContributionsOptions = {
  searchTerm?: string;
  memberId?: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  take?: number; // max ~100 per Hansard limits
  skip?: number;
  orderBy?: "SittingDateAsc" | "SittingDateDesc";
  /**
   * Client-side filter on AttributedTo. Used to isolate historical PM
   * speeches whose MemberId is -1 (e.g. AttributedTo === "The Prime Minister"
   * within Thatcher's tenure dates).
   */
  attributedTo?: string;
};

export async function searchContributions(
  opts: SearchContributionsOptions,
): Promise<{ total: number; contributions: Contribution[] }> {
  const url = new URL(`${BASE}/search/contributions/Spoken.json`);
  const set = (k: string, v: string | number | undefined) => {
    if (v === undefined || v === null) return;
    url.searchParams.set(`queryParameters.${k}`, String(v));
  };
  set("searchTerm", opts.searchTerm);
  set("memberId", opts.memberId);
  set("startDate", opts.startDate);
  set("endDate", opts.endDate);
  set("orderBy", opts.orderBy);
  set("take", opts.take ?? 20);
  set("skip", opts.skip ?? 0);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Hansard search ${res.status} ${res.statusText} for ${url.toString()}`,
    );
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `Hansard returned non-JSON (len=${text.length}): ${text.slice(0, 200)}`,
    );
  }

  const result = SearchResponseSchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Hansard response shape mismatch for ${url.toString()}\n${issues}`,
    );
  }
  const parsed = result.data;
  let contributions = parsed.Results.map(toContribution);

  if (opts.attributedTo) {
    const needle = opts.attributedTo.toLowerCase();
    contributions = contributions.filter((c) =>
      c.attributedTo.toLowerCase().includes(needle),
    );
  }

  // The API is inconsistent about which count fields it populates. Take the
  // largest non-null value (or fall back to current page length).
  const total =
    parsed.TotalResultCount ??
    Math.max(
      parsed.SpokenResultCount ?? 0,
      parsed.WrittenResultCount ?? 0,
      parsed.CorrectionsResultCount ?? 0,
      parsed.DivisionsResultCount ?? 0,
      parsed.Results.length,
    );

  return { total, contributions };
}

/** Pages fetched at the same time. 5 parallel pages tested fine live. */
const DEFAULT_PAGE_CONCURRENCY = 5;

/**
 * Async iterator over contributions across pages. Yields contributions one at
 * a time, in page order. Caller may `break` early. The Hansard endpoint's
 * `take` cap is 100 (larger values return 500), so pageSize defaults to that.
 *
 * Each page takes ~5-7s, so pages are fetched in parallel waves of
 * `concurrency`, with a short pause between waves to stay polite to the
 * public API.
 */
export async function* iterateContributions(
  opts: SearchContributionsOptions & {
    pageSize?: number;
    maxPages?: number;
    /** Pause between waves of parallel page fetches. */
    pageDelayMs?: number;
    /** Pages fetched at the same time. Default 5. */
    concurrency?: number;
  },
): AsyncGenerator<Contribution, void, unknown> {
  const pageSize = Math.min(opts.pageSize ?? 100, 100);
  const maxPages = opts.maxPages ?? Infinity;
  const pageDelayMs = opts.pageDelayMs ?? 250;
  const concurrency = Math.max(1, opts.concurrency ?? DEFAULT_PAGE_CONCURRENCY);
  const startSkip = opts.skip ?? 0;
  let page = 0;

  while (page < maxPages) {
    if (page > 0 && pageDelayMs > 0) {
      await new Promise((r) => setTimeout(r, pageDelayMs));
    }
    const waveSize = Math.min(concurrency, maxPages - page);
    const wave = await Promise.all(
      Array.from({ length: waveSize }, (_, i) =>
        searchContributions({
          ...opts,
          take: pageSize,
          skip: startSkip + (page + i) * pageSize,
        }),
      ),
    );
    for (const { contributions } of wave) {
      // Trust "empty page = exhausted" rather than the unreliable total field.
      if (contributions.length === 0) return;
      for (const c of contributions) yield c;
    }
    page += waveSize;
  }
}
