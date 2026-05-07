import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ChatCta } from "@/components/chat-cta";
import { getMember, type Member } from "@/lib/members";

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

async function loadMember(rawId: string): Promise<Member> {
  const id = parsePositiveInt(rawId);
  if (id === null) notFound();

  try {
    return await getMember(id);
  } catch {
    notFound();
  }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const numericId = parsePositiveInt(id);
    if (numericId === null) return { title: "Profile not found" };
    const member = await getMember(numericId);
    return {
      title: `${member.name} — Statesmen AI`,
      description: member.fullTitle ?? `Profile of ${member.name}.`,
    };
  } catch {
    return { title: "Profile not found" };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
//
// Same brutalist-with-brand-yellow language as the landing page and the chat
// page: yellow accent pill at the top, oversized confident headline, then a
// two-column photo/info layout that breathes. The photo sits in a bare
// `border-2 border-foreground` rectangle (no card chrome, no soft corners),
// and the CTA is a hand-rolled brutalist primary button anchoring the page.

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = await loadMember(id);
  const term = formatTerm(member);

  // Build the yellow accent pill: "PARTY · TERM" if both, else whichever we
  // have, falling back to just the house. Keeps the pill terse and
  // information-rich, like the landing-page hero badge.
  const pillBits: string[] = [];
  if (member.party) pillBits.push(member.party);
  if (term) pillBits.push(term);
  if (pillBits.length === 0) pillBits.push(member.house);
  const pillText = pillBits.join(" · ");

  // Sub-headline: small uppercase-tracked accent line under the name.
  // House always shows; fullTitle joins with a separator when distinct from
  // the display name, so peers/MPs read at a glance.
  const subBits: string[] = [member.house];
  if (member.fullTitle && member.fullTitle !== member.name) {
    subBits.push(member.fullTitle);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
      {/* ─ Hero band ────────────────────────────────────────────────────────
         Matches the landing-page rhythm: yellow pill, oversized name, small
         uppercase accent line. Sits above the photo/info split so the eye
         lands on the name first. */}
      <header className="flex flex-col items-start">
        <span className="mb-8 inline-block bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-foreground">
          {pillText}
        </span>

        <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          {member.name}
        </h1>

        <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
          {subBits.join(" · ")}
        </p>
      </header>

      {/* ─ Photo + info split ───────────────────────────────────────────────
         Single column on mobile, two columns from sm+. Photo gets a bare
         border rectangle — no card, no shadow, no soft corners. Info column
         flows naturally beside it. */}
      <section className="mt-12 grid gap-10 sm:mt-16 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] sm:gap-12">
        {/* Photo — brutalist frame with optional party-colour stripe. */}
        <div className="relative max-w-sm">
          {member.partyColor ? (
            <span
              aria-hidden
              className="absolute -left-3 top-0 block h-full w-1.5 sm:-left-4 sm:w-2"
              style={{ backgroundColor: member.partyColor }}
            />
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={member.photoUrl}
            alt={`Portrait of ${member.name}`}
            className="aspect-[3/4] w-full rounded-md border-2 border-foreground bg-muted object-cover"
            loading="eager"
          />
        </div>

        {/* Info column — bio paragraph + CTA + tiny footnote. */}
        <div className="flex flex-col gap-8">
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            Profile sourced from the UK Parliament Members API. Click below to
            chat with an AI persona built from {member.name}&apos;s real
            recorded speeches in Hansard.
          </p>

          <div>
            <ChatCta id={member.id} name={member.name} />
          </div>

          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            AI-generated · Not actual statements by {member.name}
          </p>
        </div>
      </section>
    </div>
  );
}
