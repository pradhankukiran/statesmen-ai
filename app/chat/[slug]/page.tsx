import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { ChatWindow } from "@/components/chat-window";
import { getPersona } from "@/lib/cache";
import { getMemberPhotoUrl } from "@/lib/members";

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
    const cached = await getPersona(slug);
    if (cached === null) return { title: "Chat — Statesmen AI" };
    return {
      title: `Chat with ${cached.meta.name} — Statesmen AI`,
      description: `An AI persona of ${cached.meta.name}, grounded in real Hansard speeches.`,
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

  const cached = await getPersona(slug);
  if (cached === null) {
    // The user shouldn't reach this page without a built persona; bounce to home.
    redirect("/");
  }

  const { meta } = cached;
  const photoUrl =
    typeof meta.memberId === "number"
      ? getMemberPhotoUrl(meta.memberId)
      : undefined;

  return (
    <ChatWindow
      slug={slug}
      name={meta.name}
      photoUrl={photoUrl}
      suggestedStarters={suggestedStartersFor(meta.name)}
    />
  );
}
