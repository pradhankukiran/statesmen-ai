/**
 * Speech index smoke test: fetch → embed → save to Neon → sample search.
 *
 *   npm run script:speeches [-- "your question"]
 *
 * Needs DATABASE_URL, EMBED_URL and EMBED_API_KEY in .env.local.
 */

import { buildSpeechIndex, searchSpeeches } from "../lib/speeches";

try {
  process.loadEnvFile(".env.local");
} catch {
  // OK if missing
}

const TARGET = {
  slug: "boris-johnson",
  name: "Boris Johnson",
  fetch: { kind: "memberId" as const, memberId: 1423, max: 500 },
};

const question =
  process.argv.slice(2).find((a) => !a.startsWith("--")) ??
  "What do you think about hospital waiting lists?";

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

async function main() {
  console.log(`Building speech index for ${TARGET.name}…`);
  const result = await buildSpeechIndex({
    ...TARGET,
    onProgress: (e) => {
      if (e.type === "fetch_done") console.log(`  fetched ${e.count} speeches`);
      if (e.type === "embed_progress" && e.done === e.total) {
        console.log(`  embedded ${e.total} speeches`);
      }
      if (e.type === "save_done") console.log(`  saved ${e.count} speeches`);
    },
  });
  const t = result.timingsMs;
  console.log(
    `Done: fetch ${secs(t.fetch)}, embed ${secs(t.embed)}, ` +
      `save ${secs(t.save)}, total ${secs(t.total)}`,
  );

  console.log(`\nQuestion: ${question}`);
  const t0 = Date.now();
  const matches = await searchSpeeches(TARGET.slug, question, 5);
  console.log(`Search took ${secs(Date.now() - t0)}`);
  for (const m of matches) {
    console.log(
      `\n  [${m.similarity.toFixed(3)}] ${m.sittingDate} · ${m.debateTitle ?? "untitled"}\n` +
        `  ${m.text.slice(0, 200).replace(/\s+/g, " ")}…`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
