import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { ChatWindow } from "@/components/chat-window";
import { getPerson } from "@/lib/speeches";
import { getMemberPhotoUrl } from "@/lib/members";
import { getPopularPMBySlug, photoUrlForMember } from "@/lib/popular";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generic openers that work for any politician. Per-person starters (from
 * what they actually spoke about) are a later improvement.
 */
const STARTERS = [
  "What are you proudest of from your time in Parliament?",
  "What is Britain's place in the world?",
  "How should we fix the NHS?",
  "What advice would you give a new MP?",
];

function subtitleFor(person: { speechCount: number; endedAt: string | null }): string {
  const speeches = `${person.speechCount.toLocaleString("en-GB")} speeches`;
  return person.endedAt
    ? `${speeches} · until ${person.endedAt.slice(0, 4)}`
    : `${speeches} · still serving`;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const person = await getPerson(slug);
    if (person === null) return { title: "Chat — Statesmen AI" };
    return {
      title: `Chat with ${person.name} — Statesmen AI`,
      description: `An AI persona of ${person.name}, grounded in real Hansard speeches.`,
    };
  } catch {
    return { title: "Chat — Statesmen AI" };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const person = await getPerson(slug);
  if (person === null) {
    // Not built yet. Featured people (home cards link straight here) go to
    // their build page; anything else goes home.
    const pm = getPopularPMBySlug(slug);
    if (pm?.kind === "memberId") redirect(`/build/${slug}?id=${pm.id}`);
    if (pm?.kind === "attribution") redirect(`/build/${slug}`);
    redirect("/");
  }

  // Photo source preference for the chat header avatar:
  //   1. The person's own `memberId` (modern PMs).
  //   2. The `photoMemberId` recorded in popular-pms.json for historical
  //      figures (e.g. Thatcher's Lords-era id 953).
  //   3. Undefined → the avatar falls back to initials.
  const popular = getPopularPMBySlug(slug);
  const photoMemberId =
    person.memberId !== null
      ? person.memberId
      : popular?.kind === "attribution" && popular.photoMemberId !== undefined
        ? popular.photoMemberId
        : null;
  const photoUrl =
    person.memberId !== null
      ? photoUrlForMember(person.memberId)
      : photoMemberId !== null
        ? getMemberPhotoUrl(photoMemberId)
        : undefined;

  return (
    <ChatWindow
      slug={slug}
      name={person.name}
      photoUrl={photoUrl}
      subtitle={subtitleFor(person)}
      suggestedStarters={STARTERS}
    />
  );
}
