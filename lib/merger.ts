import { z } from "zod";
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { MERGE_SYSTEM, buildMergePrompt } from "./prompts/merge";
import type { Extraction } from "./extractor";
import { mergeModels, isFallbackableError } from "./models";

// ─── Schema for the consolidated persona ──────────────────────────────────────

export const MergedPersonaSchema = z.object({
  vocabulary: z
    .array(z.string())
    .describe(
      "15–30 deduplicated distinctive words and pet phrases used by the speaker",
    ),
  sentencePatterns: z
    .string()
    .describe(
      "2–3 sentences synthesising typical sentence structure (length, rhythm, hedging, parallelism, etc.)",
    ),
  rhetoricalDevices: z
    .array(z.string())
    .describe(
      "5–10 deduplicated named rhetorical devices the speaker habitually uses",
    ),
  tone: z
    .string()
    .describe(
      "2–3 sentences capturing the through-line of the speaker's emotional and intellectual register",
    ),
  topics: z
    .array(z.string())
    .describe(
      "8–15 cross-cutting themes that recur across the speaker's corpus",
    ),
  openings: z
    .array(z.string())
    .describe("5–10 typical phrase openings used by the speaker"),
  closings: z
    .array(z.string())
    .describe("5–10 typical phrase closings used by the speaker"),
  examples: z
    .array(z.string())
    .describe(
      "20–30 BEST verbatim quotes selected from across all chunks. Each must be a direct quote — never paraphrase.",
    ),
});

export type MergedPersona = z.infer<typeof MergedPersonaSchema>;

// ─── Public API ───────────────────────────────────────────────────────────────

export type MergeOptions = {
  /** Override the OpenRouter model id list. Default: lib/models#mergeModels(). */
  models?: string[];
  temperature?: number;
  /**
   * Where to start in the fallback list. Defaults to 0; orchestrator may
   * rotate this so merge doesn't always hit the same model that just did
   * extraction (and may be rate-limited).
   */
  startModelIndex?: number;
};

async function callOnce(
  apiKey: string,
  modelId: string,
  name: string,
  extractions: Extraction[],
  temperature: number,
): Promise<MergedPersona> {
  const openrouter = createOpenRouter({ apiKey });
  const { object } = await generateObject({
    model: openrouter(modelId),
    schema: MergedPersonaSchema,
    system: MERGE_SYSTEM,
    prompt: buildMergePrompt(name, extractions),
    temperature,
    // The merged persona JSON is larger than a single extraction (more
    // examples, deduplicated vocabulary, etc.) but still well under 6k tokens.
    maxOutputTokens: 8000,
    // The merger's own fallback list handles retry; the SDK's internal
    // retries just multiply rate-limit pressure on already-throttled
    // upstreams.
    maxRetries: 0,
  });
  return object;
}

export async function mergeExtractions(
  name: string,
  extractions: Extraction[],
  opts: MergeOptions = {},
): Promise<MergedPersona> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  if (extractions.length === 0) {
    throw new Error("Cannot merge zero extractions.");
  }

  const pool = opts.models && opts.models.length > 0 ? opts.models : mergeModels();
  const start = ((opts.startModelIndex ?? 0) % pool.length + pool.length) % pool.length;
  const ordered = [...pool.slice(start), ...pool.slice(0, start)];
  const temperature = opts.temperature ?? 0.3;

  let lastError: unknown;
  for (const modelId of ordered) {
    try {
      return await callOnce(apiKey, modelId, name, extractions, temperature);
    } catch (err) {
      lastError = err;
      if (!isFallbackableError(err)) throw err;
    }
  }

  throw new Error(
    `Merge failed across all ${ordered.length} model(s) in the fallback list. ` +
      `Last error: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
  );
}
