import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Hero } from "@/components/hero";

export const metadata: Metadata = {
  title: "Politician not found — Statesmen AI",
  description: "We couldn't find that politician in the Members API.",
};

export default function ProfileNotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14 lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
      <Hero
        size="lg"
        eyebrow="404 · Not found"
        headline="We couldn't find that politician."
        body="The Members API has no record matching that profile ID. They may have been removed, or the link is malformed."
      >
        <Button variant="primary" size="lg" render={<Link href="/" />}>
          Browse politicians
        </Button>
      </Hero>
    </div>
  );
}
