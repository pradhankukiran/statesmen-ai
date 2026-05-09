// Shared profile loader for the full /p/[id] route AND the intercepted modal
// at app/@modal/(.)p/[id]. Both render the same person, sourced from the same
// pair of registries (Members API for numeric ids, popular-pms.json for slug
// entries), so the resolution lives here once.

import { notFound } from "next/navigation";

import { getMember, getMemberPhotoUrl, type Member } from "@/lib/members";
import { getPopularPMBySlug, type PopularPM } from "@/lib/popular";
import { slugify } from "@/lib/slug";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parsePositiveInt(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function formatYear(iso: string | null): string | null {
  if (!iso) return null;
  const year = iso.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

export function formatTerm(member: Member): string | null {
  const start = formatYear(member.startedAt);
  if (!start) return null;
  const end = formatYear(member.endedAt) ?? "present";
  if (start === end) return start;
  return `${start}–${end}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

// ─── Profile data ─────────────────────────────────────────────────────────────

export type ProfileData = {
  slug: string;
  name: string;
  fullTitle: string | null;
  party: string | null;
  partyColor: string | null;
  house: string;
  term: string | null;
  photoUrl: string | null;
  memberId: number | null;
  popular: PopularPM | null;
};

/**
 * Resolve a profile by URL segment. Numeric segments hit the Members API;
 * slug segments resolve from the popular-pms registry. Throws via `notFound()`
 * when neither path produces a hit so callers can rely on the result being
 * present.
 */
export async function loadProfile(rawId: string): Promise<ProfileData> {
  const numericId = parsePositiveInt(rawId);
  if (numericId !== null) {
    let member: Member;
    try {
      member = await getMember(numericId);
    } catch {
      notFound();
    }
    return {
      slug: slugify(member.name),
      name: member.name,
      fullTitle: member.fullTitle,
      party: member.party,
      partyColor: member.partyColor,
      house: member.house,
      term: formatTerm(member),
      photoUrl: member.photoUrl,
      memberId: member.id,
      popular: null,
    };
  }

  const pm = getPopularPMBySlug(rawId);
  if (pm === undefined) notFound();

  return {
    slug: pm.slug,
    name: pm.name,
    fullTitle: null,
    party: pm.party,
    partyColor: pm.partyColor,
    house: pm.house,
    term: pm.term,
    photoUrl:
      pm.kind === "memberId"
        ? pm.photoUrl
        : pm.photoMemberId !== undefined
          ? getMemberPhotoUrl(pm.photoMemberId)
          : null,
    memberId: pm.kind === "memberId" ? pm.id : null,
    popular: pm,
  };
}
