import Image from "next/image";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import type { Metadata } from "next";

import { ChatCta } from "@/components/chat-cta";
import { PartyLabel } from "@/components/ui/party-label";
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

  const meta = [profile.house, profile.term].filter(Boolean).join(" · ");
  const portraitName = `portrait-${profile.memberId ?? profile.popular?.slug ?? id}`;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-16 lg:h-full lg:overflow-y-auto">
      <section className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-10">
        {/* Portrait. Shared-element name matches PersonCard's. */}
        <div className="relative aspect-[4/5] w-32 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border sm:w-56">
          {profile.photoUrl ? (
            <ViewTransition name={portraitName}>
              <Image
                src={profile.photoUrl}
                alt={`Portrait of ${profile.name}`}
                fill
                sizes="(min-width: 640px) 224px, 128px"
                priority
                className="object-cover"
              />
            </ViewTransition>
          ) : (
            <div
              aria-hidden
              className="flex size-full items-center justify-center bg-muted text-title font-medium text-muted-foreground"
            >
              {initials(profile.name)}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-title font-semibold tracking-tight">{profile.name}</h1>
            <div className="flex flex-wrap items-center gap-1.5 text-small text-muted-foreground">
              <PartyLabel party={profile.party} color={profile.partyColor} />
              {meta && <span aria-hidden>·</span>}
              {meta && <span>{meta}</span>}
            </div>
            {profile.fullTitle && profile.fullTitle !== profile.name && (
              <p className="text-small text-muted-foreground">{profile.fullTitle}</p>
            )}
          </div>

          <p className="text-body text-muted-foreground">
            Chat with an AI persona that answers from {profile.name}&apos;s
            real speeches in Parliament.
          </p>

          <div>
            <ChatCta
              slug={profile.slug}
              name={profile.name}
              memberId={profile.memberId}
              hasAttribution={profile.popular?.kind === "attribution"}
            />
          </div>

          <p className="text-small text-muted-foreground">
            AI-generated. Not real statements by {profile.name}.
          </p>
        </div>
      </section>
    </div>
  );
}
