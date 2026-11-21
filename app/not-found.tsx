import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Hero } from "@/components/hero";
import { SiteShell } from "@/components/layout/site-shell";

export const metadata: Metadata = {
  title: "Not found — Statesmen AI",
  description: "This page isn't in Hansard. Or anywhere else for that matter.",
};

export default function NotFound() {
  return (
    <SiteShell>
    <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14">
      <Hero
        headline="Not in the record."
        body="This page isn't in Hansard. Or anywhere else for that matter."
      >
        <Button variant="primary" size="lg" render={<Link href="/" />}>
          Back to homepage
        </Button>
      </Hero>
    </div>
    </SiteShell>
  );
}
