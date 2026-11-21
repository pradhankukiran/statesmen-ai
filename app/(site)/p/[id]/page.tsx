import Image from "next/image";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import type { Metadata } from "next";

import { ChatCta } from "@/components/chat-cta";
import { PartyLabel } from "@/components/ui/party-label";
import { BackLink, InsetText, PageHeading, SummaryList } from "@/components/ui/govuk";
import { getMember, getMemberPhotoUrl, type Member } from "@/lib/members";
import {
  displayNameForMember,
  getPopularPMByMemberId,
  getPopularPMBySlug,
  photoUrlForMember,
  type PopularPM,
} from "@/lib/popular";
import { slugify } from "@/lib/slug";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePositiveInt(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function formatYear(iso: string | null): string | null {
  if (!iso) return null;
  const year = iso.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

function formatTerm(member: Member): string | null {
  const start = formatYear(member.startedAt);
  if (!start) return null;
  const end = formatYear(member.endedAt) ?? "present";
  if (start === end) return start;
  return `${start}–${end}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

// ─── Profile data ─────────────────────────────────────────────────────────────

type ProfileData = {
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

async function loadProfile(rawId: string): Promise<ProfileData> {
  const numericId = parsePositiveInt(rawId);
  if (numericId !== null) {
    let member: Member;
    try {
      member = await getMember(numericId);
    } catch {
      notFound();
    }
    const popular = getPopularPMByMemberId(member.id) ?? null;
    const name = displayNameForMember(member.id, member.name);
    return {
      // Featured people keep their featured slug; the build and chat routes
      // also match on member ID, so either slug finds the same persona.
      slug: popular?.slug ?? slugify(name),
      name,
      fullTitle: member.fullTitle,
      party: member.party,
      partyColor: member.partyColor,
      house: member.house,
      term: formatTerm(member),
      photoUrl: photoUrlForMember(member.id),
      memberId: member.id,
      popular,
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

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const profile = await loadProfile(id);
    return {
      title: `${profile.name} — Statesmen AI`,
      description: profile.fullTitle ?? `Profile of ${profile.name}.`,
    };
  } catch {
    return { title: "Profile not found" };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await loadProfile(id);

  const portraitName = `portrait-${profile.memberId ?? profile.popular?.slug ?? id}`;
  const rows = [
    { key: "Party", value: profile.party ? <PartyLabel party={profile.party} color={profile.partyColor} /> : "Unknown" },
    { key: "House", value: profile.house === "Lords" ? "House of Lords" : "House of Commons" },
    ...(profile.term ? [{ key: "Years", value: profile.term }] : []),
    ...(profile.fullTitle && profile.fullTitle !== profile.name
      ? [{ key: "Full title", value: profile.fullTitle }]
      : []),
  ];

  return (
    <>
      <BackLink href="/" className="mb-6">All politicians</BackLink>
      <PageHeading caption={profile.house === "Lords" ? "Member of the House of Lords" : "Member of Parliament"}>
        {profile.name}
      </PageHeading>

      <div className="mt-8 flex flex-col gap-8 tablet:flex-row tablet:gap-10">
        {/* Portrait. Shared-element name matches PersonCard's. */}
        <div className="relative aspect-[4/5] w-40 shrink-0 overflow-hidden bg-muted tablet:w-56">
          {profile.photoUrl ? (
            <ViewTransition name={portraitName}>
              <Image
                src={profile.photoUrl}
                alt={`Portrait of ${profile.name}`}
                fill
                sizes="(min-width: 640px) 224px, 160px"
                priority
                className="object-cover"
              />
            </ViewTransition>
          ) : (
            <div
              aria-hidden
              className="flex size-full items-center justify-center text-l font-bold text-muted-foreground"
            >
              {initials(profile.name)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <SummaryList rows={rows} className="mb-8" />
          <p className="mb-6 text-body">
            Ask {profile.name} a question. Answers are drawn from their real
            speeches in Parliament.
          </p>
          <ChatCta
            slug={profile.slug}
            name={profile.name}
            memberId={profile.memberId}
            hasAttribution={profile.popular?.kind === "attribution"}
          />
          <InsetText className="mt-8">
            Replies are AI-generated. They are not real statements by{" "}
            {profile.name}.
          </InsetText>
        </div>
      </div>
    </>
  );
}
