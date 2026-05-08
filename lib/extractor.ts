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
  abortSignal?: AbortSignal,
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
    abortSignal,
    // No retries here. In race mode, the race itself is the retry
    // mechanism — internal retries waste rate-limit quota on the same
    // already-throttled upstream provider, take seconds each, and push
    // toward Vercel's 60s function timeout. In the chunked-fallback
    // chain, the per-chunk fallback list also handles retry semantics
    // at a higher level. Either way, one shot per call is correct.
    maxRetries: 0,
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

// ─── Race-mode extraction ─────────────────────────────────────────────────────

/**
 * Race the extraction across all configured models in parallel using
 * `Promise.any`. The first valid `Extraction` wins; the others are aborted
 * via a shared `AbortController` so we don't keep paying for losing calls.
 *
 * Used by `buildPersona` for the typical small-corpus path (≤ ~80k tokens),
 * where the full text fits in one LLM call. Skips the chunked + merge
 * pipeline entirely for that case — extraction *is* the persona.
 *
 * Throws when every model fails. The error message includes per-model
 * failure details so the caller can see which models broke and why.
 */
export async function raceExtractAcrossModels(
  personName: string,
  text: string,
  opts: ExtractOptions = {},
): Promise<Extraction> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }

  const pool = opts.models && opts.models.length > 0 ? opts.models : extractModels();
  if (pool.length === 0) {
    throw new Error("raceExtractAcrossModels: model pool is empty.");
  }
  const temperature = opts.temperature ?? 0.2;

  // One controller cancels every losing in-flight request when a winner
  // emerges. Each branch races its own call; whichever resolves first
  // signals the rest to bail.
  const controller = new AbortController();
  const failures: { model: string; error: string }[] = [];

  const attempts = pool.map((modelId) =>
    callOnce(apiKey, modelId, personName, text, temperature, controller.signal)
      .then((result) => {
        // Cancel the still-pending peers as soon as we have a winner.
        controller.abort();
        return result;
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push({ model: modelId, error: msg });
        throw err;
      }),
  );

  try {
    return await Promise.any(attempts);
  } catch (err) {
    // `Promise.any` rejects with `AggregateError` when every input rejects.
    // Surface the per-model failure detail (capped to last 5 to avoid log
    // floods) so the caller can see which models broke and why.
    const tail = failures.slice(-5);
    const detail = tail
      .map((f) => `  - ${f.model}: ${f.error}`)
      .join("\n");
    const aggregate = err instanceof AggregateError ? err : undefined;
    throw new Error(
      `Race extraction failed: all ${pool.length} model(s) errored.\n` +
        `Last ${tail.length} failure(s):\n${detail}` +
        (aggregate ? "" : `\nNon-aggregate error: ${err instanceof Error ? err.message : String(err)}`),
    );
  }
}
