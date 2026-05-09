import Image from "next/image";
import type { Metadata } from "next";

import { ChatCta } from "@/components/chat-cta";
import { Hero } from "@/components/hero";
import { initials, loadProfile } from "./profile-data";

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
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <Hero size="lg" eyebrow={eyebrow} headline={profile.name}>
        <p className="-mt-3 text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {subBits.join(" · ")}
        </p>
      </Hero>

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
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-muted ring-1 ring-border">
              <Image
                src={profile.photoUrl}
                alt={`Portrait of ${profile.name}`}
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                priority
                className="object-cover"
                // Shared-element name: must match the value PersonCard sets on
                // the same portrait. Cards keyed by a numeric Members API id
                // surface `memberId` here; attribution PMs (Thatcher etc.)
                // come in via the slug route, where `popular.slug` matches
                // the URL `id`. Both branches resolve to the card's value.
                style={{
                  viewTransitionName: `portrait-${profile.memberId ?? profile.popular?.slug ?? id}`,
                }}
              />
            </div>
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
  );
}
