import { z } from "zod";
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { EXTRACT_SYSTEM, buildExtractPrompt } from "./prompts/extract";

// ─── Output schema (also used as AI SDK structured-output schema) ─────────────

export const ExtractionSchema = z.object({
  vocabulary: z
    .array(z.string())
    .describe("5–15 distinctive words or pet phrases this person uses"),
  sentencePatterns: z
    .string()
    .describe(
      "1–2 sentences describing typical sentence structure (length, rhythm, hedging, etc.)",
    ),
  rhetoricalDevices: z
    .array(z.string())
    .describe(
      "3–7 named rhetorical patterns (e.g. 'rule of three', 'anaphora', 'antithesis')",
    ),
  tone: z
    .string()
    .describe("1 sentence on emotional and intellectual register"),
  topics: z
    .array(z.string())
    .describe("5–10 themes that appear in this chunk"),
  openings: z
    .array(z.string())
    .describe("3–5 typical phrase openings used by the speaker"),
  closings: z
    .array(z.string())
    .describe("3–5 typical phrase closings used by the speaker"),
  examples: z
    .array(z.string())
    .describe(
      "8–15 VERBATIM quotes copied from the transcript that best exemplify the speaker's voice",
    ),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

// ─── Public API ───────────────────────────────────────────────────────────────

const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";

export type ExtractOptions = {
  /** Override the OpenRouter model id. Default: env or claude-3.5-sonnet. */
  model?: string;
  /** Sampling temperature. Default 0.2 — extraction wants determinism. */
  temperature?: number;
};

export async function extractStyleFromChunk(
  personName: string,
  chunkText: string,
  opts: ExtractOptions = {},
): Promise<Extraction> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }

  const openrouter = createOpenRouter({ apiKey });
  const modelId =
    opts.model ?? process.env.OPENROUTER_EXTRACT_MODEL ?? DEFAULT_MODEL;

  const { object } = await generateObject({
    model: openrouter(modelId),
    schema: ExtractionSchema,
    system: EXTRACT_SYSTEM,
    prompt: buildExtractPrompt(personName, chunkText),
    temperature: opts.temperature ?? 0.2,
  });

  return object;
}
