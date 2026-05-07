import Link from "next/link";
import type { Metadata } from "next";

import { BuildProgress, type BuildAttribution } from "@/components/build-progress";
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
      <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
        <BuildProgress slug={slug} name={name} memberId={memberId} />
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
      <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
        <BuildProgress slug={slug} name={pm.name} attribution={attribution} />
      </div>
    );
  }

  // ─── Fallback: neither path applies ───────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <div className="flex flex-col items-start">
        <span className="mb-8 inline-block bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-foreground">
          Malformed URL
        </span>
        <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          This build URL is malformed.
        </h1>
        <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          The build URL we received doesn&apos;t map to a known persona. Head
          back to the homepage and pick a Prime Minister to start from.
        </p>
        <Link
          href="/"
          className="mt-10 inline-flex items-center gap-3 rounded-md border-2 border-foreground bg-brand px-6 py-3 text-base font-semibold text-brand-foreground transition-colors hover:bg-brand/85 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          Return to homepage
        </Link>
      </div>
    </div>
  );
}
