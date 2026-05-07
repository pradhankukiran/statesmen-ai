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
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toContribution(r: z.infer<typeof ContributionRawSchema>): Contribution {
  // Prefer the already-clean ContributionText; fall back to stripping the full
  // markup version if needed.
  const text =
    r.ContributionText && r.ContributionText.trim().length > 0
      ? r.ContributionText.trim()
      : stripXml(r.ContributionTextFull ?? "");
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

/**
 * Async iterator over contributions across pages. Yields contributions one at
 * a time. Caller may `break` early. The Hansard endpoint's `take` cap appears
 * to be 100; pageSize defaults to that. A small delay between pages keeps the
 * public API happy.
 */
export async function* iterateContributions(
  opts: SearchContributionsOptions & {
    pageSize?: number;
    maxPages?: number;
    pageDelayMs?: number;
  },
): AsyncGenerator<Contribution, void, unknown> {
  const pageSize = Math.min(opts.pageSize ?? 100, 100);
  const maxPages = opts.maxPages ?? Infinity;
  const pageDelayMs = opts.pageDelayMs ?? 250;
  let skip = opts.skip ?? 0;
  let pages = 0;

  while (pages < maxPages) {
    if (pages > 0 && pageDelayMs > 0) {
      await new Promise((r) => setTimeout(r, pageDelayMs));
    }
    const { contributions } = await searchContributions({
      ...opts,
      take: pageSize,
      skip,
    });
    // Trust "empty page = exhausted" rather than the unreliable total field.
    if (contributions.length === 0) return;
    for (const c of contributions) yield c;
    pages++;
    skip += pageSize;
  }
}
