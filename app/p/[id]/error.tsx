"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ProfileError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-24 sm:py-32">
      <span className="mb-8 inline-block bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-foreground">
        Profile error
      </span>

      <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
        Couldn&apos;t load that profile.
      </h1>

      <p className="mt-6 max-w-xl text-lg text-muted-foreground">
        The Members API didn&apos;t respond as expected. This is usually
        transient — try again, or pick someone else from the homepage.
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
