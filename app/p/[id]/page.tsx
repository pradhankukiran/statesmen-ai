import Image from "next/image";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import type { Metadata } from "next";

import { ChatCta } from "@/components/chat-cta";
import { Hero } from "@/components/hero";
import { getMember, getMemberPhotoUrl, type Member } from "@/lib/members";
import { getPopularPMBySlug, type PopularPM } from "@/lib/popular";
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

  // Eyebrow assembly: "PARTY · TERM" if both, else whichever we have.
  const pillBits: string[] = [];
  if (profile.party) pillBits.push(profile.party);
  if (profile.term) pillBits.push(profile.term);
  if (pillBits.length === 0) pillBits.push(profile.house);
  const eyebrow = pillBits.join(" · ");

  // Sub-headline below the name.
  const subBits: string[] = [profile.house];
  if (profile.fullTitle && profile.fullTitle !== profile.name) {
    subBits.push(profile.fullTitle);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14 lg:flex lg:h-full lg:flex-col lg:overflow-hidden lg:py-0 lg:pt-10">
      <div className="lg:flex-shrink-0">
        <Hero size="lg" eyebrow={eyebrow} headline={profile.name}>
          <p className="-mt-3 text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {subBits.join(" · ")}
          </p>
        </Hero>
      </div>

      <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pb-10">
        {/* Photo + info split. Single column on mobile, two columns from sm+. */}
        <section className="mt-12 grid gap-10 sm:mt-16 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] sm:gap-12">
          {/* Photo — soft Card-style chrome with optional party-colour stripe. */}
          <div className="relative max-w-sm">
            {profile.partyColor ? (
              <span
                aria-hidden
                className="absolute -left-3 top-0 block h-full w-1 rounded-full sm:-left-4 sm:w-1.5"
                style={{ backgroundColor: profile.partyColor }}
              />
            ) : null}
            {profile.photoUrl ? (
              // Shared-element name must match what PersonCard sets on the same
              // portrait. Cards keyed by a numeric Members API id surface
              // `memberId` here; attribution PMs (Thatcher etc.) come in via
              // the slug route, where `popular.slug` matches the URL `id`.
              <ViewTransition
                name={`portrait-${profile.memberId ?? profile.popular?.slug ?? id}`}
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-muted ring-1 ring-border">
                  <Image
                    src={profile.photoUrl}
                    alt={`Portrait of ${profile.name}`}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    priority
                    className="object-cover"
                  />
                </div>
              </ViewTransition>
            ) : (
              <div
                aria-hidden
                className="flex aspect-[3/4] w-full items-center justify-center rounded-2xl bg-brand text-6xl font-semibold tracking-tight text-brand-foreground ring-1 ring-border sm:text-7xl"
              >
                {initials(profile.name)}
              </div>
            )}
          </div>

          {/* Info column. */}
          <div className="flex flex-col gap-8">
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Profile sourced from the UK Parliament Members API. Click below to
              chat with an AI persona built from {profile.name}&apos;s real
              recorded speeches in Hansard.
            </p>

            <div>
              <ChatCta
                slug={profile.slug}
                name={profile.name}
                memberId={profile.memberId}
                hasAttribution={
                  profile.popular?.kind === "attribution" ? true : false
                }
              />
            </div>

            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              AI-generated · Not actual statements by {profile.name}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
