import { z } from "zod";

const BASE = "https://members-api.parliament.uk/api";

// ─── Raw API schemas ───────────────────────────────────────────────────────────

const PartySchema = z.object({
  name: z.string(),
  backgroundColour: z.string().nullish(),
  foregroundColour: z.string().nullish(),
});

const HouseMembershipSchema = z.object({
  house: z.number(), // 1 = Commons, 2 = Lords
  membershipFrom: z.string().nullish(),
  membershipStartDate: z.string().nullish(),
  membershipEndDate: z.string().nullish(),
});

const MemberValueSchema = z.object({
  id: z.number(),
  nameDisplayAs: z.string(),
  nameFullTitle: z.string().nullish(),
  nameListAs: z.string().nullish(),
  latestParty: PartySchema.nullish(),
  latestHouseMembership: HouseMembershipSchema,
  gender: z.string().nullish(),
  thumbnailUrl: z.string().nullish(),
});

const SearchResponseSchema = z.object({
  items: z.array(z.object({ value: MemberValueSchema })),
  totalResults: z.number(),
});

const SingleMemberResponseSchema = z.object({
  value: MemberValueSchema,
});

/** Shape shared by house memberships and government posts. */
const GovernmentPostSchema = z.object({
  name: z.string(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
});

const BiographyResponseSchema = z.object({
  value: z.object({
    houseMemberships: z.array(GovernmentPostSchema).nullish(),
    governmentPosts: z.array(GovernmentPostSchema).nullish(),
  }),
});

// ─── Public types (slim, app-friendly) ────────────────────────────────────────

export type House = "Commons" | "Lords";

export type Member = {
  id: number;
  name: string;
  fullTitle: string | null;
  party: string | null;
  partyColor: string | null;
  house: House;
  startedAt: string | null;
  endedAt: string | null;
  photoUrl: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function houseFromCode(code: number): House {
  return code === 2 ? "Lords" : "Commons";
}

function houseToCode(house: House): "1" | "2" {
  return house === "Commons" ? "1" : "2";
}

export function getMemberPhotoUrl(id: number): string {
  // The /Portrait endpoint 404s for almost every member regardless of cropType.
  // /Thumbnail is the endpoint the Members API itself returns in `thumbnailUrl`
  // and is reliably 200 for both current MPs and historic peers.
  return `${BASE}/Members/${id}/Thumbnail`;
}

function toMember(v: z.infer<typeof MemberValueSchema>): Member {
  return {
    id: v.id,
    name: v.nameDisplayAs,
    fullTitle: v.nameFullTitle ?? null,
    party: v.latestParty?.name ?? null,
    partyColor: v.latestParty?.backgroundColour
      ? `#${v.latestParty.backgroundColour.replace(/^#/, "")}`
      : null,
    house: houseFromCode(v.latestHouseMembership.house),
    startedAt: v.latestHouseMembership.membershipStartDate ?? null,
    endedAt: v.latestHouseMembership.membershipEndDate ?? null,
    photoUrl: getMemberPhotoUrl(v.id),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type SearchMembersOptions = {
  name: string;
  house?: House;
  includeFormer?: boolean;
  take?: number;
  skip?: number;
};

export async function searchMembers(opts: SearchMembersOptions): Promise<{
  total: number;
  members: Member[];
}> {
  const url = new URL(`${BASE}/Members/Search`);
  url.searchParams.set("Name", opts.name);
  url.searchParams.set("IsCurrentMember", String(!opts.includeFormer));
  if (opts.house) url.searchParams.set("House", houseToCode(opts.house));
  url.searchParams.set("take", String(opts.take ?? 20));
  url.searchParams.set("skip", String(opts.skip ?? 0));

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Members API search failed: ${res.status} ${res.statusText}`);
  }

  const parsed = SearchResponseSchema.parse(await res.json());
  return {
    total: parsed.totalResults,
    members: parsed.items.map((it) => toMember(it.value)),
  };
}

export async function getMember(id: number): Promise<Member> {
  const res = await fetch(`${BASE}/Members/${id}`);
  if (!res.ok) {
    throw new Error(`Members API getMember(${id}) failed: ${res.status}`);
  }
  const parsed = SingleMemberResponseSchema.parse(await res.json());
  return toMember(parsed.value);
}

export type DateRange = {
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD, null while still serving
};

export type CareerDates = {
  /** Every spell in either House, gaps between them excluded. */
  memberships: DateRange[];
  /** Spells as Prime Minister. Empty for everyone else. */
  pmTenures: DateRange[];
};

/**
 * Matches the Prime Minister post itself ("Prime Minister, First Lord of the
 * Treasury…", "Prime Minister and First Lord…") but not posts like
 * "Prime Minister's Special Representative…".
 */
const PM_POST = /^Prime Minister(?:,| and\b|$)/i;

function toDateRanges(
  items: { startDate?: string | null; endDate?: string | null }[],
): DateRange[] {
  return items.flatMap((p) =>
    p.startDate
      ? [
          {
            startDate: p.startDate.slice(0, 10),
            endDate: p.endDate ? p.endDate.slice(0, 10) : null,
          },
        ]
      : [],
  );
}

/** Career dates from the Biography endpoint (one fast call, ~0.4s). */
export async function getCareerDates(id: number): Promise<CareerDates> {
  const res = await fetch(`${BASE}/Members/${id}/Biography`);
  if (!res.ok) {
    throw new Error(`Members API biography(${id}) failed: ${res.status}`);
  }
  const { value } = BiographyResponseSchema.parse(await res.json());
  return {
    memberships: toDateRanges(value.houseMemberships ?? []),
    pmTenures: toDateRanges(
      (value.governmentPosts ?? []).filter((p) => PM_POST.test(p.name)),
    ),
  };
}
