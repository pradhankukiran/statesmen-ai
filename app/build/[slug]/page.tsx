import Link from "next/link";
import type { Metadata } from "next";

import { BuildProgress, type BuildAttribution } from "@/components/build-progress";
import { Button } from "@/components/ui/button";
import { Hero } from "@/components/hero";
import { getMember } from "@/lib/members";
import { getPopularPMBySlug } from "@/lib/popular";

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
//
// Two routes converge here, distinguished by what the URL provides:
//
//   • `?id=<memberId>` → modern PM. We fetch their display name from the
//     Members API and feed BuildProgress a `memberId` config.
//
//   • no `?id` → historical figure. We look up the slug in
//     popular-pms.json server-side and feed BuildProgress an `attribution`
//     config sourced from the registry. This is how Thatcher & Churchill
//     reach attribution-mode builds.
//
// If neither path resolves we render a malformed-URL state in the same
// brutalist language as the rest of the site.

export default async function BuildPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);

  const memberId = parsePositiveInt(readSearchParam(sp, "id"));

  // ─── Path 1: modern (memberId) ────────────────────────────────────────────
  if (memberId !== null) {
    let name: string;
    try {
      const member = await getMember(memberId);
      name = member.name;
    } catch {
      // Server-side lookup failed; fall back to the slug. The build endpoint
      // only needs `name` for the system prompt header, so this is safe.
      name = slug;
    }
    return (
      <div className="lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
        <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          <BuildProgress slug={slug} name={name} memberId={memberId} />
        </div>
      </div>
    );
  }

  // ─── Path 2: historical (attribution) ─────────────────────────────────────
  const pm = getPopularPMBySlug(slug);
  if (pm && pm.kind === "attribution") {
    const attribution: BuildAttribution = {
      label: pm.attribution.label,
      startDate: pm.attribution.startDate,
      endDate: pm.attribution.endDate,
      searchTerms: pm.attribution.searchTerms,
    };
    return (
      <div className="lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
        <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          <BuildProgress slug={slug} name={pm.name} attribution={attribution} />
        </div>
      </div>
    );
  }

  // ─── Fallback: neither path applies ───────────────────────────────────────
  return (
    <div className="lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
      <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
        <Hero
          eyebrow="Malformed URL"
          headline="This build URL is malformed."
          body="The build URL we received doesn't map to a known persona. Head back to the homepage and pick a Prime Minister to start from."
        >
          <Button variant="primary" size="lg" render={<Link href="/" />}>
            Return to homepage
          </Button>
        </Hero>
      </div>
    </div>
  );
}
