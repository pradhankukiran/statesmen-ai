"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    // Surface the error in dev tools; production telemetry would go here too.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-24 sm:py-32">
      <span className="mb-8 inline-block bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-foreground">
        Error
      </span>

      <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
        Something tripped.
      </h1>

      <p className="mt-6 max-w-xl text-lg text-muted-foreground">
        An unexpected error interrupted the page. Try again — and if it sticks,
        head back to the homepage.
      </p>

      {error.digest ? (
        <p className="mt-4 font-mono text-xs text-muted-foreground/80">
          digest: {error.digest}
        </p>
      ) : null}

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={() => reset()}>
          Try again
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/" />}>
          Back to homepage
        </Button>
      </div>
    </div>
  );
}
