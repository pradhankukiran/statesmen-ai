import { z } from "zod";
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { EXTRACT_SYSTEM, buildExtractPrompt } from "./prompts/extract";
import { extractModels, isFallbackableError } from "./models";

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

export type ExtractOptions = {
  /** Override the OpenRouter model id list. Default: lib/models#extractModels(). */
  models?: string[];
  /** Sampling temperature. Default 0.2 — extraction wants determinism. */
  temperature?: number;
  /**
   * Where to start in the fallback list (rotated, modulo length). Useful for
   * spreading parallel chunk extractions across different models so they
   * don't all hit the same upstream rate-limit.
   */
  startModelIndex?: number;
};

async function callOnce(
  apiKey: string,
  modelId: string,
  personName: string,
  chunkText: string,
  temperature: number,
): Promise<Extraction> {
  const openrouter = createOpenRouter({ apiKey });
  const { object } = await generateObject({
    model: openrouter(modelId),
    schema: ExtractionSchema,
    system: EXTRACT_SYSTEM,
    prompt: buildExtractPrompt(personName, chunkText),
    temperature,
    // The structured extraction JSON typically lands at 1.5–2.5k tokens.
    // OpenRouter pre-charges for the cap, so leave headroom but don't ask
    // for the model's full ceiling — that blocks budget-limited accounts.
    maxOutputTokens: 4000,
  });
  return object;
}

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

  const pool = opts.models && opts.models.length > 0 ? opts.models : extractModels();
  const start = ((opts.startModelIndex ?? 0) % pool.length + pool.length) % pool.length;
  const ordered = [...pool.slice(start), ...pool.slice(0, start)];
  const temperature = opts.temperature ?? 0.2;

  let lastError: unknown;
  for (const modelId of ordered) {
    try {
      return await callOnce(apiKey, modelId, personName, chunkText, temperature);
    } catch (err) {
      lastError = err;
      if (!isFallbackableError(err)) throw err;
      // try next model
    }
  }

  throw new Error(
    `Extraction failed across all ${ordered.length} model(s) in the fallback list. ` +
      `Last error: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
  );
}
