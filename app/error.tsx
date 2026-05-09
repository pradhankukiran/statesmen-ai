"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Hero } from "@/components/hero";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14">
      <Hero
        eyebrow="Error"
        headline="Something tripped."
        body="An unexpected error interrupted the page. Try again — and if it sticks, head back to the homepage."
        bodyMaxWidth="max-w-none"
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
