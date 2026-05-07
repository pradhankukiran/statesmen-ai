import Link from "next/link";
import type { Metadata } from "next";

import { BuildProgress } from "@/components/build-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMember } from "@/lib/members";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePositiveInt(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = searchParams[key];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Building persona — Statesmen AI",
  description: "Generating an AI persona from real Hansard speeches.",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BuildPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);

  const memberId = parsePositiveInt(readSearchParam(sp, "id"));

  if (memberId === null) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
        <Card>
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:p-8">
            <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              Build URL is malformed.
            </h1>
            <p className="text-sm text-muted-foreground">
              This build URL is malformed. Return to homepage.
            </p>
            <Button render={<Link href="/" />}>Return to homepage</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch the member's name server-side. If lookup fails we still render the
  // page using the slug as a fallback display name, since the build endpoint
  // only needs `name` for the system prompt.
  let name: string;
  try {
    const member = await getMember(memberId);
    name = member.name;
  } catch {
    name = slug;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
      <BuildProgress slug={slug} name={name} memberId={memberId} />
    </div>
  );
}
