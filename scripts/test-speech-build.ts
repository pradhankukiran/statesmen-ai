/**
 * Speech index smoke test: fetch → embed → save to Neon → sample search.
 *
 *   npm run script:speeches [-- "your question"]
 *   npm run script:speeches -- --featured   # every person in popular-pms.json
 *
 * Needs DATABASE_URL, EMBED_URL and EMBED_API_KEY in .env.local.
 */

import { buildSpeechIndex, searchSpeeches } from "../lib/speeches";
import { getPopularPMs } from "../lib/popular";
import type { FetchConfig } from "../lib/collect";

try {
  process.loadEnvFile(".env.local");
} catch {
  // OK if missing
}

type Target = { slug: string; name: string; fetch: FetchConfig };

const MAX_SPEECHES = 500;

const BORIS: Target = {
  slug: "boris-johnson",
  name: "Boris Johnson",
  fetch: { kind: "memberId", memberId: 1423, max: MAX_SPEECHES },
};

function featuredTargets(): Target[] {
  return getPopularPMs().map((pm) => ({
    slug: pm.slug,
    name: pm.name,
    fetch:
      pm.kind === "memberId"
        ? { kind: "memberId", memberId: pm.id, max: MAX_SPEECHES }
        : {
            kind: "attribution",
            label: pm.attribution.label,
            startDate: pm.attribution.startDate,
            endDate: pm.attribution.endDate,
            searchTerms: pm.attribution.searchTerms,
            max: MAX_SPEECHES,
          },
  }));
}

const question =
  process.argv.slice(2).find((a) => !a.startsWith("--")) ??
  "What do you think about hospital waiting lists?";

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

async function build(target: Target): Promise<boolean> {
  console.log(`\nBuilding speech index for ${target.name}…`);
  try {
    const result = await buildSpeechIndex(target);
    const t = result.timingsMs;
    console.log(
      `  ${result.speechCount} speeches: fetch ${secs(t.fetch)}, ` +
        `embed ${secs(t.embed)}, save ${secs(t.save)}, total ${secs(t.total)}`,
    );
    return true;
  } catch (err) {
    console.error(`  FAILED: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

async function main() {
  // Sequential on purpose: keeps load on the public Hansard API modest.
  const targets = process.argv.includes("--featured") ? featuredTargets() : [BORIS];
  const failed: string[] = [];
  for (const target of targets) {
    if (!(await build(target))) failed.push(target.name);
  }

  const sample = targets.find((t) => !failed.includes(t.name));
  if (sample) {
    console.log(`\nQuestion for ${sample.name}: ${question}`);
    const t0 = Date.now();
    const matches = await searchSpeeches(sample.slug, question, 5);
    console.log(`Search took ${secs(Date.now() - t0)}`);
    for (const m of matches) {
      console.log(
        `\n  [${m.similarity.toFixed(3)}] ${m.sittingDate} · ${m.debateTitle ?? "untitled"}\n` +
          `  ${m.text.slice(0, 200).replace(/\s+/g, " ")}…`,
      );
    }
  }

  if (failed.length > 0) {
    console.error(`\nFailed: ${failed.join(", ")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
