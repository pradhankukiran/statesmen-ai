"use client";

import Link from "next/link";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

// ─── ProfileError ─────────────────────────────────────────────────────────────
//
// Same brutalist rhythm as the profile page itself: yellow pill, oversized
// confident headline, supporting paragraph, then a primary brutalist CTA next
// to a quieter outline alternative. No shadcn Button — the action pair has to
// match the profile page's "Chat with X" button visually.

export default function ProfileError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <span className="mb-8 inline-block bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-foreground">
        Profile error
      </span>

      <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
        Couldn&apos;t load that profile.
      </h1>

      <p className="mt-8 max-w-xl text-base text-muted-foreground sm:text-lg">
        The Members API didn&apos;t respond as expected. This is usually
        transient — try again, or pick someone else from the homepage.
      </p>

      {error.digest ? (
        <p className="mt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground/80">
          digest: {error.digest}
        </p>
      ) : null}

      <div className="mt-12 flex flex-wrap items-center gap-4">
        {/* Primary brutalist action — same shape/weight as the profile-page
           CTA so the user immediately knows where to click. */}
        <button
          type="button"
          onClick={() => reset()}
          className={cn(
            "inline-flex items-center gap-3 rounded-md border-2 border-foreground bg-brand px-6 py-3 text-base font-semibold text-brand-foreground sm:px-8 sm:py-4 sm:text-lg",
            "cursor-pointer transition-colors hover:bg-brand/85 active:translate-y-px",
            "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand",
          )}
        >
          Try again
        </button>

        {/* Secondary action — bordered ghost rectangle, hover flips to brand
           yellow (mirrors the chat starter chips). */}
        <Link
          href="/"
          className={cn(
            "inline-flex items-center gap-3 rounded-md border-2 border-border bg-background px-6 py-3 text-base font-semibold text-foreground sm:px-8 sm:py-4 sm:text-lg",
            "transition-colors hover:border-foreground hover:bg-brand hover:text-brand-foreground",
            "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand",
          )}
        >
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
