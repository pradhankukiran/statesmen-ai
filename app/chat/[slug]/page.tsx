import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { ChatWindow } from "@/components/chat-window";
import { getPerson } from "@/lib/speeches";
import { getMemberPhotoUrl } from "@/lib/members";
import { getPopularPMBySlug } from "@/lib/popular";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function suggestedStartersFor(name: string): string[] {
  return [
    `Tell me about your time in office, ${name.split(" ").slice(-1)[0]}.`,
    "What is your view on the role of Britain in the world?",
    "What advice would you give a young politician starting out today?",
  ];
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
    // The user shouldn't reach this page without a built persona; bounce to home.
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
    photoMemberId !== null ? getMemberPhotoUrl(photoMemberId) : undefined;

  return (
    <ChatWindow
      slug={slug}
      name={person.name}
      photoUrl={photoUrl}
      suggestedStarters={suggestedStartersFor(person.name)}
    />
  );
}
