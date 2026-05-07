import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Politician not found — Statesmen AI",
  description: "We couldn't find that politician in the Members API.",
};

export default function ProfileNotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-24 sm:py-32">
      <span className="mb-8 inline-block bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-foreground">
        404
      </span>

      <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
        We couldn&apos;t find that politician.
      </h1>

      <p className="mt-6 max-w-xl text-lg text-muted-foreground">
        The Members API has no record matching that profile ID. They may have
        been removed, or the link is malformed.
      </p>

      <div className="mt-10">
        <Button size="lg" render={<Link href="/" />}>
          Browse politicians
        </Button>
      </div>
    </div>
  );
}
