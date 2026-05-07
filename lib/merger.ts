import { z } from "zod";
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { MERGE_SYSTEM, buildMergePrompt } from "./prompts/merge";
import type { Extraction } from "./extractor";
import { MERGE_MODEL } from "./models";

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
  /** Override the OpenRouter model id. Default: lib/models#MERGE_MODEL. */
  model?: string;
  temperature?: number;
};

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

  const openrouter = createOpenRouter({ apiKey });
  const modelId = opts.model ?? MERGE_MODEL;

  const { object } = await generateObject({
    model: openrouter(modelId),
    schema: MergedPersonaSchema,
    system: MERGE_SYSTEM,
    prompt: buildMergePrompt(name, extractions),
    temperature: opts.temperature ?? 0.3,
  });

  return object;
}
