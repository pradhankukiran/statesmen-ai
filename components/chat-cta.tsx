"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slug";

type StatusResponse =
  | { status: "ready" }
  | { status: "missing" }
  | { error: string };

type Props = {
  id: number;
  name: string;
};

// ─── ChatCta ──────────────────────────────────────────────────────────────────
//
// The page's anchor action. Hand-rolled brutalist primary button — flat brand
// yellow, heavy black border, sharp corners, big confident type. Sits at the
// same visual weight as the chat composer's send-state and the landing-page
// "highlight" pill.
//
// Loading copy stays as "Checking…" but renders in the same big type as the
// resting state so the button doesn't shrink/wobble between states.

export function ChatCta({ id, name }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBusy = isChecking || isPending;
  const slug = slugify(name);

  async function handleClick() {
    setError(null);
    setIsChecking(true);
    try {
      const res = await fetch(
        `/api/persona/status?slug=${encodeURIComponent(slug)}`,
        { cache: "no-store" },
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as Partial<StatusResponse>;
        throw new Error(
          ("error" in body && body.error) ||
            `Status check failed (${res.status})`,
        );
      }

      const data = (await res.json()) as StatusResponse;

      if ("status" in data && data.status === "ready") {
        startTransition(() => {
          router.push(`/chat/${slug}`);
        });
        return;
      }

      if ("status" in data && data.status === "missing") {
        startTransition(() => {
          router.push(`/build/${slug}?id=${id}`);
        });
        return;
      }

      throw new Error("Unexpected response from status endpoint.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not check persona status.";
      setError(message);
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isBusy}
        aria-busy={isBusy || undefined}
        className={cn(
          // Brutalist primary: flat brand-yellow fill, heavy black border,
          // sharp rounded-md corners, oversized confident type.
          "inline-flex items-center gap-3 rounded-md border-2 border-foreground bg-brand px-6 py-3 text-base font-semibold text-brand-foreground sm:px-8 sm:py-4 sm:text-lg",
          // Tactile press: yellow darkens slightly on hover, button drops
          // 1px on click. No shadow, no soft transition — just edges.
          "transition-colors hover:bg-brand/85 active:translate-y-px",
          // Brand yellow stays in the focus ring so the affordance reads
          // even on darker backgrounds.
          "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {isBusy ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Checking…
          </>
        ) : (
          <>
            <MessageSquare className="size-5" aria-hidden />
            Chat with {name}
          </>
        )}
      </button>
      {error ? (
        <p
          role="alert"
          className="rounded-md border-2 border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
