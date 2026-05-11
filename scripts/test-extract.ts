/**
 * Smoke test for the chunker + extractor.
 *
 *   npm run script:extract
 *
 * Without GROQ_API_KEY: chunks Thatcher's Falklands speeches and prints
 * sizes (no LLM call). With the key set in .env.local: runs the full
 * extraction on chunk 1 and prints the structured result.
 */

import {
  iterateContributions,
  type Contribution,
} from "../lib/hansard";
import { chunkByTokens, countTokens } from "../lib/chunker";
import { extractStyleFromChunk } from "../lib/extractor";

try {
  process.loadEnvFile(".env.local");
} catch {
  // OK if missing
}

const div = (label: string) =>
  console.log(`\n── ${label} ${"─".repeat(Math.max(0, 70 - label.length))}`);

async function main() {
  console.log("Statesmen AI · extractor smoke test");

  div("1. Walk Hansard 1982 looking for Thatcher PM speeches");
  const TARGET = 80;
  const MAX_PAGES = 15;
  const contributions: Contribution[] = [];
  let scanned = 0;
  for await (const c of iterateContributions({
    startDate: "1982-04-01",
    endDate: "1982-12-31",
    pageSize: 100,
    maxPages: MAX_PAGES,
    pageDelayMs: 400,
  })) {
    scanned++;
    if (c.attributedTo === "The Prime Minister") {
      contributions.push(c);
      if (contributions.length >= TARGET) break;
    }
  }
  console.log(
    `Scanned ${scanned} contributions across ≤${MAX_PAGES} pages → kept ${contributions.length} PM speeches.`,
  );
  if (contributions.length === 0) {
    console.error("No PM contributions found; aborting.");
    process.exit(1);
  }

  div("2. Chunk the corpus");
  const text = contributions.map((c) => c.text).join("\n\n");
  console.log(
    `Concatenated: ${text.length.toLocaleString()} chars · ${countTokens(
      text,
    ).toLocaleString()} tokens`,
  );

  const chunks = chunkByTokens(text, { maxTokens: 8000 });
  console.log(`Split into ${chunks.length} chunk(s):`);
  chunks.forEach((c, i) => {
    console.log(
      `  · chunk ${i + 1}: ${countTokens(c).toLocaleString()} tokens`,
    );
  });

  div("3. Extract style from chunk 1");
  if (!process.env.GROQ_API_KEY) {
    console.log("⚠ GROQ_API_KEY not set — skipping extraction call.");
    console.log("  Add it to .env.local and re-run to see the LLM output.");
    return;
  }

  console.log("Calling OpenRouter…");
  const t0 = Date.now();
  const extraction = await extractStyleFromChunk(
    "Margaret Thatcher",
    chunks[0],
  );
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Extraction complete in ${dt}s.\n`);

  console.log("=== EXTRACTION ===");
  console.log(JSON.stringify(extraction, null, 2));
}

main().catch((err) => {
  console.error("\nFAILED:", err);
  process.exit(1);
});
