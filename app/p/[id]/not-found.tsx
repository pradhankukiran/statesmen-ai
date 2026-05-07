import Link from "next/link";
import type { Metadata } from "next";

import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Politician not found — Statesmen AI",
  description: "We couldn't find that politician in the Members API.",
};

// ─── ProfileNotFound ──────────────────────────────────────────────────────────
//
// 404 surface inside the profile route. Mirrors the profile-page hero exactly:
// yellow pill, oversized headline, supporting paragraph, brutalist primary
// link back to the homepage. No shadcn Button so the visual weight matches
// the profile page's "Chat with X" button.

export default function ProfileNotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <span className="mb-8 inline-block bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-foreground">
        404 · Not found
      </span>

      <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
        We couldn&apos;t find that politician.
      </h1>

      <p className="mt-8 max-w-xl text-base text-muted-foreground sm:text-lg">
        The Members API has no record matching that profile ID. They may have
        been removed, or the link is malformed.
      </p>

      <div className="mt-12">
        <Link
          href="/"
          className={cn(
            "inline-flex items-center gap-3 rounded-md border-2 border-foreground bg-brand px-6 py-3 text-base font-semibold text-brand-foreground sm:px-8 sm:py-4 sm:text-lg",
            "transition-colors hover:bg-brand/85 active:translate-y-px",
            "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand",
          )}
        >
          Browse politicians
        </Link>
      </div>
    </div>
  );
}
