/**
 * Speech collection: which of a person's Hansard contributions to keep.
 *
 *   memberId personas   → sampled across their whole time in Parliament
 *                         (date windows, half for any PM tenure)
 *   attribution personas → historical figures with no MemberId on their
 *                         speeches, matched by `AttributedTo` within dates
 */

import {
  iterateContributions,
  searchContributions,
  type Contribution,
} from "./hansard";
import { getCareerDates, type CareerDates } from "./members";
import { mapWithConcurrency } from "./concurrency";

/**
 * Contributions under this many words are procedural ("I refer the hon. Lady
 * to the answer that I gave earlier.") and carry no style. Kept low on
 * purpose: short PMQs answers are often the most characteristic lines.
 */
const MIN_CONTRIBUTION_WORDS = 15;

/**
 * Date windows a career is split into, one Hansard page each, all fetched at
 * once. Every call takes ~5-6s whatever its size, and 12 in parallel finish
 * in ~10s, so one wide wave beats several narrow ones.
 */
const CAREER_WINDOWS = 12;

/** Hansard's maximum page size. */
const PAGE_SIZE = 100;

/** Candidates wanted per speech kept, to cover short ones being dropped. */
const SAMPLE_OVERSHOOT = 1.3;

/** Share of the windows given to their time as Prime Minister, if any. */
const PM_TENURE_SHARE = 0.5;

/** Cap on the extra pages fetched when the first wave comes up short. */
const MAX_TOPUP_PAGES = 12;

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

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Accumulates contributions, skipping short procedural ones, until `max`
 * are collected.
 */
function createCollector(max: number) {
  const items: Contribution[] = [];
  return {
    items,
    /** Adds `c` if it qualifies. Returns true once the collector is full. */
    add(c: Contribution): boolean {
      if (items.length >= max) return true;
      if (wordCount(c.text) < MIN_CONTRIBUTION_WORDS) return false;
      items.push(c);
      return items.length >= max;
    },
  };
}

type DateWindow = { startDate?: string; endDate?: string };
type MsRange = { start: number; end: number };

const DAY_MS = 86_400_000;
const toIsoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** `ranges` with every part covered by `cut` removed. */
function subtractRanges(ranges: MsRange[], cut: MsRange[]): MsRange[] {
  let out = ranges;
  for (const c of cut) {
    out = out.flatMap((r) => {
      if (c.end <= r.start || c.start >= r.end) return [r];
      const parts: MsRange[] = [];
      if (c.start > r.start) parts.push({ start: r.start, end: c.start });
      if (c.end < r.end) parts.push({ start: c.end, end: r.end });
      return parts;
    });
  }
  return out.filter((r) => r.end - r.start >= DAY_MS);
}

/** Split `ranges` into `n` windows, shared out by each range's length. */
function spreadWindows(ranges: MsRange[], n: number): DateWindow[] {
  const total = ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
  if (n <= 0 || total <= 0) return [];
  // Largest-remainder allocation so the counts sum to exactly `n`.
  const exact = ranges.map((r) => (n * (r.end - r.start)) / total);
  const counts = exact.map(Math.floor);
  let left = n - counts.reduce((a, b) => a + b, 0);
  for (const i of exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac)
    .map((x) => x.i)) {
    if (left-- <= 0) break;
    counts[i]++;
  }
  return ranges.flatMap((r, i) =>
    Array.from({ length: counts[i] }, (_, k) => {
      const len = (r.end - r.start) / counts[i];
      return {
        startDate: toIsoDate(r.start + k * len),
        endDate: toIsoDate(r.start + (k + 1) * len),
      };
    }),
  );
}

/**
 * Date windows covering a member's time in Parliament. Half go to their time
 * as Prime Minister when they held it. Gaps between spells are skipped. With
 * no career data, falls back to one open window (newest speeches first).
 */
function planCareerWindows(career: CareerDates | null): DateWindow[] {
  if (!career || career.memberships.length === 0) return [{}];
  const now = Date.now();
  const toMs = (ranges: CareerDates["memberships"]): MsRange[] =>
    ranges
      .map((d) => ({
        start: Date.parse(d.startDate),
        end: d.endDate ? Date.parse(d.endDate) : now,
      }))
      .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start);

  const pm = toMs(career.pmTenures);
  const served = subtractRanges(toMs(career.memberships), pm);
  const pmCount = pm.length > 0 ? Math.round(CAREER_WINDOWS * PM_TENURE_SHARE) : 0;
  const windows = [
    ...spreadWindows(pm, pmCount),
    ...spreadWindows(served, CAREER_WINDOWS - pmCount),
  ];
  return windows.length > 0 ? windows : [{}];
}

/**
 * Sample a member's speeches evenly across their time in Parliament: one
 * page per date window, all fetched in parallel, plus a top-up wave from
 * windows with more speeches when the first wave comes up short.
 */
async function collectAcrossCareer(
  memberId: number,
  max: number,
): Promise<Contribution[]> {
  const career = await getCareerDates(memberId).catch((err) => {
    console.warn(
      `[persona] career lookup failed for memberId=${memberId}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  });
  const windows = planCareerWindows(career);

  // A failed page is skipped rather than failing the whole build.
  const fetchPage = async (w: DateWindow, skip: number) => {
    try {
      return await searchContributions({
        memberId,
        orderBy: "SittingDateDesc",
        startDate: w.startDate,
        endDate: w.endDate,
        take: PAGE_SIZE,
        skip,
      });
    } catch (err) {
      console.warn(
        `[persona] Hansard page failed (memberId=${memberId}, ` +
          `${w.startDate ?? "start"}..${w.endDate ?? "now"}, skip=${skip}):`,
        err instanceof Error ? err.message : err,
      );
      return { total: 0, contributions: [] as Contribution[] };
    }
  };

  const first = await mapWithConcurrency(windows, CAREER_WINDOWS, (w) =>
    fetchPage(w, 0),
  );
  const pools = first.map((r) => [...r.contributions]);

  // Top-up: sparse windows (gaps in Hansard's records, short careers) leave
  // us short, so pull further pages from windows that have more.
  const want = Math.ceil(max * SAMPLE_OVERSHOOT);
  const have = pools.reduce((sum, p) => sum + p.length, 0);
  if (have < want) {
    // Share the extra pages round-robin among windows with unread speeches,
    // then space each window's pages evenly through it. Results within a
    // window are newest first, so sequential pages would only reach back a
    // few weeks.
    const extraPages = windows.map(() => 0);
    const unread = (i: number) =>
      first[i].total - PAGE_SIZE * (1 + extraPages[i]) > 0;
    let pagesLeft = Math.min(MAX_TOPUP_PAGES, Math.ceil((want - have) / PAGE_SIZE));
    while (pagesLeft > 0 && windows.some((_, i) => unread(i))) {
      for (let i = 0; i < windows.length && pagesLeft > 0; i++) {
        if (!unread(i)) continue;
        extraPages[i]++;
        pagesLeft--;
      }
    }
    const extra = extraPages.flatMap((m, i) =>
      Array.from({ length: m }, (_, j) => ({
        w: i,
        skip: Math.floor(((j + 1) * first[i].total) / (m + 1)),
      })),
    );
    const more = await mapWithConcurrency(extra, MAX_TOPUP_PAGES, (e) =>
      fetchPage(windows[e.w], e.skip),
    );
    extra.forEach((e, k) => pools[e.w].push(...more[k].contributions));
  }

  // Pass 1: each window fills an equal share. Pass 2: leftovers fill any
  // room a sparse window left, taken round-robin so no window dominates.
  const quotaCount = Math.ceil(max / windows.length);
  const seen = new Set<string>();
  const leftovers: Contribution[][] = windows.map(() => []);
  const picked: Contribution[] = [];
  pools.forEach((pool, i) => {
    const quota = createCollector(quotaCount);
    for (const c of pool) {
      if (seen.has(c.id)) continue; // windows share boundary days
      seen.add(c.id);
      const before = quota.items.length;
      if (before < quotaCount) quota.add(c);
      if (quota.items.length === before) leftovers[i].push(c);
    }
    picked.push(...quota.items);
  });

  const collector = createCollector(max);
  let full = false;
  for (const c of picked) {
    if ((full = collector.add(c))) break;
  }
  for (let k = 0; !full; k++) {
    let any = false;
    for (const pool of leftovers) {
      if (k >= pool.length) continue;
      any = true;
      if ((full = collector.add(pool[k]))) break;
    }
    if (!any) break;
  }

  return collector.items.sort((a, b) => a.date.localeCompare(b.date));
}

export async function collectContributions(
  config: FetchConfig,
): Promise<Contribution[]> {
  const collector = createCollector(config.max);

  if (config.kind === "memberId") {
    return collectAcrossCareer(config.memberId, config.max);
  }

  // Attribution-based path (historical figures whose MemberId is unset).
  if (config.searchTerms && config.searchTerms.length > 0) {
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
    const seen = new Set<string>();
    outer: for (const { contributions } of perTerm) {
      for (const c of contributions) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        if (collector.add(c)) break outer;
      }
    }
    return collector.items;
  }

  // Date-only scan: walk all contributions, filter client-side.
  for await (const c of iterateContributions({
    startDate: config.startDate,
    endDate: config.endDate,
    pageSize: 100,
    pageDelayMs: 400,
    maxPages: config.maxScanPages ?? 30,
  })) {
    if (c.attributedTo === config.label && collector.add(c)) break;
  }
  return collector.items;
}
