/**
 * Popular-PMs registry.
 *
 * `data/popular-pms.json` is the homepage seed list AND the authoritative
 * source for figures whose persona is built via attribution mode (historical
 * PMs whose pre-2000 Hansard speeches don't carry a Members API id).
 *
 * Two entry shapes share the file:
 *   - `memberId` entries: modern PMs, addressable by numeric Members API id.
 *     They keep `id` so `/p/<id>` continues to resolve via `getMember()`.
 *   - `attribution` entries: historical PMs (Thatcher, Churchill). They have
 *     no `id`, but carry an `attribution` config the build endpoint consumes
 *     to filter Hansard by `AttributedTo` within a date range. `slug` is the
 *     URL identifier — `/p/<slug>` resolves via this registry.
 *
 * Both shapes carry the same display fields (name, party, term, etc.) so the
 * homepage grid and profile page can render either uniformly.
 */
import rawData from "@/data/popular-pms.json";
import { getMemberPhotoUrl } from "@/lib/members";

// ─── Common display fields ───────────────────────────────────────────────────

type CommonFields = {
  slug: string;
  name: string;
  party: string;
  partyColor: string;
  house: "Commons" | "Lords";
  term: string;
  tagline: string;
};

// ─── Attribution shape (mirrors lib/persona.ts FetchConfig "attribution") ────

export type PopularAttribution = {
  label: string;
  startDate: string;
  endDate: string;
  searchTerms?: string[];
};

// ─── Tagged union of registry entries ────────────────────────────────────────

export type PopularPMMemberId = CommonFields & {
  kind: "memberId";
  id: number;
  /**
   * Pre-resolved photo URL. Present for modern PMs; we keep the explicit URL
   * in JSON so the homepage can render without round-tripping the Members API.
   */
  photoUrl: string;
};

export type PopularPMAttribution = CommonFields & {
  kind: "attribution";
  attribution: PopularAttribution;
  /**
   * Optional Members API id used purely to source a thumbnail (e.g. Thatcher
   * has a Lords-era id 953 with a portrait, even though her PM speeches have
   * no MemberId). When omitted, the UI falls back to initials.
   */
  photoMemberId?: number;
};

export type PopularPM = PopularPMMemberId | PopularPMAttribution;

// ─── Loader / narrower ───────────────────────────────────────────────────────

/**
 * Narrow a raw JSON entry into the tagged union. Throws on any entry that
 * matches neither shape, since this is a build-time invariant — the JSON
 * is checked into the repo and shouldn't drift.
 */
function narrow(entry: unknown): PopularPM {
  if (entry === null || typeof entry !== "object") {
    throw new Error("popular-pms.json entry is not an object");
  }
  const e = entry as Record<string, unknown>;

  const slug = e.slug;
  const name = e.name;
  const party = e.party;
  const partyColor = e.partyColor;
  const house = e.house;
  const term = e.term;
  const tagline = e.tagline;

  if (
    typeof slug !== "string" ||
    typeof name !== "string" ||
    typeof party !== "string" ||
    typeof partyColor !== "string" ||
    (house !== "Commons" && house !== "Lords") ||
    typeof term !== "string" ||
    typeof tagline !== "string"
  ) {
    throw new Error(
      `popular-pms.json entry is missing required display fields: ${JSON.stringify(entry)}`,
    );
  }

  const common: CommonFields = { slug, name, party, partyColor, house, term, tagline };

  // memberId-shaped entry (modern PMs).
  if (typeof e.id === "number" && Number.isInteger(e.id) && e.id > 0) {
    if (typeof e.photoUrl !== "string") {
      throw new Error(
        `popular-pms.json entry "${slug}" has 'id' but no 'photoUrl'.`,
      );
    }
    return {
      kind: "memberId",
      ...common,
      id: e.id,
      photoUrl: e.photoUrl,
    };
  }

  // attribution-shaped entry (historical PMs).
  if (e.attribution && typeof e.attribution === "object") {
    const a = e.attribution as Record<string, unknown>;
    if (
      typeof a.label !== "string" ||
      typeof a.startDate !== "string" ||
      typeof a.endDate !== "string"
    ) {
      throw new Error(
        `popular-pms.json entry "${slug}" has malformed 'attribution'.`,
      );
    }
    let searchTerms: string[] | undefined;
    if (Array.isArray(a.searchTerms)) {
      if (!a.searchTerms.every((t): t is string => typeof t === "string")) {
        throw new Error(
          `popular-pms.json entry "${slug}" has non-string entries in 'attribution.searchTerms'.`,
        );
      }
      searchTerms = a.searchTerms;
    }
    let photoMemberId: number | undefined;
    if (e.photoMemberId !== undefined) {
      if (
        typeof e.photoMemberId !== "number" ||
        !Number.isInteger(e.photoMemberId) ||
        e.photoMemberId <= 0
      ) {
        throw new Error(
          `popular-pms.json entry "${slug}" has invalid 'photoMemberId'.`,
        );
      }
      photoMemberId = e.photoMemberId;
    }
    return {
      kind: "attribution",
      ...common,
      attribution: {
        label: a.label,
        startDate: a.startDate,
        endDate: a.endDate,
        searchTerms,
      },
      photoMemberId,
    };
  }

  throw new Error(
    `popular-pms.json entry "${slug}" matches neither 'memberId' nor 'attribution' shape.`,
  );
}

// One-shot narrow at module load. The cast pinning the JSON to `unknown[]`
// avoids relying on the heterogeneous inferred shape from `resolveJsonModule`.
const POPULAR: readonly PopularPM[] = (rawData as unknown[]).map(narrow);

const BY_SLUG: Map<string, PopularPM> = new Map(POPULAR.map((p) => [p.slug, p]));

// ─── Public accessors ────────────────────────────────────────────────────────

export function getPopularPMs(): readonly PopularPM[] {
  return POPULAR;
}

export function getPopularPMBySlug(slug: string): PopularPM | undefined {
  return BY_SLUG.get(slug);
}

/**
 * Resolve the photo URL for a popular entry. memberId entries carry an
 * explicit `photoUrl`; attribution entries optionally carry a `photoMemberId`
 * we can derive a URL from. Returns null when no usable photo exists, in
 * which case downstream UI falls back to initials.
 */
export function popularPhotoUrl(pm: PopularPM): string | null {
  if (pm.kind === "memberId") return pm.photoUrl;
  if (pm.photoMemberId !== undefined) return getMemberPhotoUrl(pm.photoMemberId);
  return null;
}
