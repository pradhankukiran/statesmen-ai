"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Hero } from "@/components/hero";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ProfileError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14 lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
      <Hero
        size="lg"
        eyebrow="Profile error"
        headline="Couldn't load that profile."
        body="The Members API didn't respond as expected. This is usually transient — try again, or pick someone else from the homepage."
      >
        {error.digest ? (
          <p className="-mt-2 mb-6 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-muted-foreground/80">
            digest: {error.digest}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg" onClick={() => reset()}>
            Try again
          </Button>
          <Button variant="outline" size="lg" render={<Link href="/" />}>
            Back to homepage
          </Button>
        </div>
      </Hero>
    </div>
  );
}
