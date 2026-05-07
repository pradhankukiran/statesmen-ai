import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Not found — Statesmen AI",
  description: "This page isn't in Hansard. Or anywhere else for that matter.",
};

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-24 sm:py-32">
      <span className="mb-8 inline-block bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-foreground">
        404
      </span>

      <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
        Not in the record.
      </h1>

      <p className="mt-6 max-w-xl text-lg text-muted-foreground">
        This page isn&apos;t in Hansard. Or anywhere else for that matter.
      </p>

      <div className="mt-10">
        <Button size="lg" render={<Link href="/" />}>
          Back to homepage
        </Button>
      </div>
    </div>
  );
}
