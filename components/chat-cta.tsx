"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { slugify } from "@/lib/slug";

type StatusResponse =
  | { status: "ready" }
  | { status: "missing" }
  | { error: string };

type Props = {
  id: number;
  name: string;
};

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
    <div className="flex flex-col items-start gap-2">
      <Button
        size="lg"
        onClick={handleClick}
        disabled={isBusy}
        className="bg-brand text-brand-foreground hover:bg-brand/90"
      >
        {isBusy ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Checking…
          </>
        ) : (
          <>
            <MessageSquare className="size-4" aria-hidden />
            Chat with {name}
          </>
        )}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
