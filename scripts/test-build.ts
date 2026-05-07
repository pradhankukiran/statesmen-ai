/**
 * End-to-end persona build smoke test.
 *
 *   npm run script:build [-- --thatcher | --boris]
 *
 * Default target: Boris Johnson (modern PM — server-side memberId filter is
 * fast and cheap). Pass `--thatcher` for the historical attribution path.
 *
 * Without OPENROUTER_API_KEY: runs only fetch + chunk and reports sizes.
 * With the key set: runs the full pipeline and writes
 *   data/personas/{slug}.md
 *   data/personas/{slug}.examples.json
 *   data/personas/{slug}.meta.json
 */

import { writeFile, mkdir } from "node:fs/promises";
import {
  buildPersona,
  collectContributions,
  renderPersonaExamples,
  renderPersonaMd,
  type BuildPersonaOptions,
} from "../lib/persona";
import { chunkByTokens, countTokens } from "../lib/chunker";

try {
  process.loadEnvFile(".env.local");
} catch {
  // OK if missing
}

// ─── Targets ─────────────────────────────────────────────────────────────────

const BORIS: BuildPersonaOptions = {
  slug: "boris-johnson",
  name: "Boris Johnson",
  fetch: { kind: "memberId", memberId: 1423, max: 80 },
};

const THATCHER: BuildPersonaOptions = {
  slug: "margaret-thatcher",
  name: "Margaret Thatcher",
  fetch: {
    kind: "attribution",
    label: "The Prime Minister",
    startDate: "1979-05-04",
    endDate: "1990-11-28",
    searchTerms: [
      "falklands",
      "miners",
      "european",
      "soviet",
      "unions",
      "privatisation",
      "defence",
      "ira",
    ],
    max: 120,
  },
};

const target = process.argv.includes("--thatcher") ? THATCHER : BORIS;

const div = (label: string) =>
  console.log(`\n── ${label} ${"─".repeat(Math.max(0, 70 - label.length))}`);

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Statesmen AI · build persona: ${target.name} (${target.slug})`);

  if (!process.env.OPENROUTER_API_KEY) {
    div("Pre-flight (no LLM key — running fetch + chunk only)");
    const t0 = Date.now();
    const contributions = await collectContributions(target.fetch);
    console.log(
      `Fetched ${contributions.length} contributions in ${(
        (Date.now() - t0) / 1000
      ).toFixed(1)}s.`,
    );
    const text = contributions.map((c) => c.text).join("\n\n");
    const totalTokens = countTokens(text);
    const chunks = chunkByTokens(text, { maxTokens: 8000 });
    console.log(
      `Chunked: ${chunks.length} chunk(s), ${totalTokens.toLocaleString()} total tokens.`,
    );
    chunks.forEach((c, i) =>
      console.log(`  · chunk ${i + 1}: ${countTokens(c).toLocaleString()} tokens`),
    );
    console.log(
      "\nUpstream pipeline verified. Add OPENROUTER_API_KEY to run extraction + merge.",
    );
    return;
  }

  div("Full build");
  const persona = await buildPersona({
    ...target,
    onProgress: (e) => {
      switch (e.type) {
        case "fetch_start":
          process.stdout.write("  · fetching contributions… ");
          break;
        case "fetch_done":
          console.log(`done (${e.count}).`);
          break;
        case "chunk_done":
          console.log(
            `  · chunked into ${e.chunkCount} (${e.totalTokens.toLocaleString()} tokens).`,
          );
          break;
        case "extract_start":
          process.stdout.write(
            `  · extracting chunk ${e.chunkIndex + 1}/${e.totalChunks}… `,
          );
          break;
        case "extract_done":
          console.log("done.");
          break;
        case "merge_start":
          process.stdout.write("  · merging… ");
          break;
        case "merge_done":
          console.log("done.");
          break;
        case "render_done":
          console.log("  · rendered.");
          break;
      }
    },
  });

  await mkdir("data/personas", { recursive: true });
  const md = renderPersonaMd(persona);
  const examples = renderPersonaExamples(persona);

  const base = `data/personas/${persona.meta.slug}`;
  await writeFile(`${base}.md`, md);
  await writeFile(
    `${base}.examples.json`,
    `${JSON.stringify(examples, null, 2)}\n`,
  );
  await writeFile(
    `${base}.meta.json`,
    `${JSON.stringify(persona.meta, null, 2)}\n`,
  );

  div("Output");
  console.log(`  ${base}.md            (${md.length.toLocaleString()} bytes)`);
  console.log(`  ${base}.examples.json (${examples.examples.length} examples)`);
  console.log(`  ${base}.meta.json`);
}

main().catch((err) => {
  console.error("\nFAILED:", err);
  process.exit(1);
});
