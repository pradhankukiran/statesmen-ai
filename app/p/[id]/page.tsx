import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ChatCta } from "@/components/chat-cta";
import { Card, CardContent } from "@/components/ui/card";
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

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = await loadMember(id);
  const term = formatTerm(member);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16">
      <Card size="default" className="overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* Photo column — left on desktop, top on mobile. */}
          <div className="bg-muted/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={member.photoUrl}
              alt={`Portrait of ${member.name}`}
              className="aspect-[3/4] w-full object-cover"
              loading="eager"
            />
          </div>

          {/* Info column. */}
          <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
            <header className="flex flex-col gap-2">
              <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                {member.name}
              </h1>
              {member.fullTitle && member.fullTitle !== member.name ? (
                <p className="text-base italic text-muted-foreground">
                  {member.fullTitle}
                </p>
              ) : null}
            </header>

            <dl className="flex flex-col gap-3 text-sm">
              {member.party ? (
                <div className="flex items-center gap-3">
                  <dt className="w-24 shrink-0 text-xs uppercase tracking-widest text-muted-foreground">
                    Party
                  </dt>
                  <dd className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block size-3 rounded-full ring-1 ring-foreground/15"
                      style={{
                        backgroundColor: member.partyColor ?? "transparent",
                      }}
                    />
                    <span className="font-medium">{member.party}</span>
                  </dd>
                </div>
              ) : null}

              <div className="flex items-center gap-3">
                <dt className="w-24 shrink-0 text-xs uppercase tracking-widest text-muted-foreground">
                  House
                </dt>
                <dd className="font-medium">{member.house}</dd>
              </div>

              {term ? (
                <div className="flex items-center gap-3">
                  <dt className="w-24 shrink-0 text-xs uppercase tracking-widest text-muted-foreground">
                    Term
                  </dt>
                  <dd className="font-medium tabular-nums">{term}</dd>
                </div>
              ) : null}
            </dl>

            <p className="text-sm text-muted-foreground">
              Profile sourced from the UK Parliament Members API. Click below
              to chat with an AI persona built from this member&apos;s real
              recorded speeches in Hansard.
            </p>

            <div className="mt-auto pt-2">
              <ChatCta id={member.id} name={member.name} />
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
