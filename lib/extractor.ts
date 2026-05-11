import { z } from "zod";
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { EXTRACT_SYSTEM, buildExtractPrompt } from "./prompts/extract";
import { extractModels, isFallbackableError } from "./models";

// ─── Output schemas ───────────────────────────────────────────────────────────
//
// Two shapes, structurally identical, with different array-size constraints:
//   • ExtractionSchema      — for per-chunk extractions in the chunked path
//                             (smaller arrays; one chunk = one slice of the
//                             corpus).
//   • FullCorpusPersonaSchema — for the single-call path where the entire
//                               corpus is analysed in one shot. Sized to
//                               match MergedPersonaSchema so the chat
//                               receives the same depth of vocabulary,
//                               examples, etc., regardless of which path
//                               produced the persona.

export const ExtractionSchema = z.object({
  vocabulary: z
    .array(z.string())
    .min(5)
    .max(15)
    .describe("Distinctive words or pet phrases this person uses"),
  sentencePatterns: z
    .string()
    .describe("Typical sentence structure (length, rhythm, hedging, etc.)"),
  rhetoricalDevices: z
    .array(z.string())
    .min(3)
    .max(7)
    .describe("Named rhetorical patterns (e.g. rule of three, anaphora, antithesis)"),
  tone: z
    .string()
    .describe("Emotional and intellectual register"),
  topics: z
    .array(z.string())
    .min(5)
    .max(10)
    .describe("Themes that appear in this chunk"),
  openings: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe("Typical phrase openings used by the speaker"),
  closings: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe("Typical phrase closings used by the speaker"),
  examples: z
    .array(z.string())
    .min(5)
    .max(12)
    .describe("Verbatim quotes copied from the transcript that exemplify the speaker's voice"),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

// Full-corpus persona shape — same structural type as Extraction, with
// merge-sized arrays. Identical to MergedPersonaSchema (kept here to avoid a
// merger.ts → extractor.ts cycle).
export const FullCorpusPersonaSchema = z.object({
  vocabulary: z
    .array(z.string())
    .min(8)
    .max(20)
    .describe("Distinctive words and pet phrases used across the corpus, deduplicated"),
  sentencePatterns: z
    .string()
    .describe("Synthesised typical sentence structure (length, rhythm, hedging, parallelism, etc.)"),
  rhetoricalDevices: z
    .array(z.string())
    .min(3)
    .max(8)
    .describe("Named rhetorical devices the speaker habitually uses"),
  tone: z
    .string()
    .describe("Through-line of the speaker's emotional and intellectual register"),
  topics: z
    .array(z.string())
    .min(5)
    .max(12)
    .describe("Cross-cutting themes that recur across the corpus"),
  openings: z
    .array(z.string())
    .min(3)
    .max(8)
    .describe("Typical phrase openings used by the speaker"),
  closings: z
    .array(z.string())
    .min(3)
    .max(8)
    .describe("Typical phrase closings used by the speaker"),
  examples: z
    .array(z.string())
    .min(10)
    .max(20)
    .describe("Best verbatim quotes selected from the corpus. Each must be a direct quote — never paraphrase."),
});

export type FullCorpusPersona = z.infer<typeof FullCorpusPersonaSchema>;

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
  /**
   * Caller's abort signal. Composed with each call's per-call timeout signal
   * so a route shutdown / client disconnect cancels in-flight work
   * immediately instead of letting it run to completion against the upstream.
   */
  signal?: AbortSignal;
  /**
   * Per-call timeout in ms. Defaults to 60_000. Tune low enough that the
   * full fallback walk fits inside the route's `maxDuration`.
   */
  perCallTimeoutMs?: number;
  /**
   * Optional per-attempt observer. Called when a model is selected (kind:
   * "start"), succeeds (kind: "success"), or fails fallbackably (kind:
   * "failure"). Used by the orchestrator to record `builtBy` and emit
   * progress events.
   */
  onAttempt?: (attempt: ExtractAttempt) => void;
};

export type ExtractAttempt =
  | { kind: "start"; model: string; index: number; total: number }
  | { kind: "success"; model: string; index: number; total: number }
  | { kind: "failure"; model: string; index: number; total: number; error: string };

const DEFAULT_PER_CALL_TIMEOUT_MS = 60_000;

function composeSignals(signals: (AbortSignal | undefined)[]): AbortSignal {
  const real = signals.filter((s): s is AbortSignal => s !== undefined);
  if (real.length === 0) {
    // No real signal — return a never-aborted signal.
    return new AbortController().signal;
  }
  if (real.length === 1) return real[0];
  // AbortSignal.any combines multiple signals (any one aborts the result).
  // Available in Node 20+ / modern runtimes.
  return AbortSignal.any(real);
}

async function callOnce<S extends z.ZodTypeAny>(
  apiKey: string,
  modelId: string,
  schema: S,
  personName: string,
  text: string,
  temperature: number,
  maxOutputTokens: number,
  signal: AbortSignal,
): Promise<z.infer<S>> {
  const openrouter = createOpenRouter({ apiKey });
  const { object } = await generateObject({
    // The Zod schema's runtime shape and the AI SDK's generic inference
    // don't unify cleanly across `S extends z.ZodTypeAny` callers. Both
    // branches feed identical schema shapes (object schemas with array +
    // string fields), so the runtime contract holds.
    model: openrouter(modelId),
    schema: schema as z.ZodSchema<z.infer<S>>,
    system: EXTRACT_SYSTEM,
    prompt: buildExtractPrompt(personName, text),
    temperature,
    // OpenRouter pre-charges for the cap, so leave headroom but don't ask
    // for the model's full ceiling — that blocks budget-limited accounts.
    maxOutputTokens,
    abortSignal: signal,
    // No retries here. The fallback list is the retry mechanism — internal
    // retries waste rate-limit quota on the same already-throttled upstream.
    maxRetries: 0,
    // Disable hidden reasoning/chain-of-thought tokens. The extraction is a
    // structured pattern-matching task — reasoning adds latency (10–50K
    // hidden tokens on models like nvidia/nemotron-*-super) without
    // measurable quality gain, and pushes calls past the per-call timeout.
    // No-op on non-reasoning models.
    providerOptions: {
      openrouter: {
        reasoning: { enabled: false, effort: "none" },
      },
    },
  });
  return object as z.infer<S>;
}

/**
 * Walk the model fallback list sequentially. The first model is tried; on
 * a fallbackable error (rate limit, parse failure, transient 5xx, etc.) the
 * next model in the ordered list is tried, until one succeeds or all fail.
 *
 * Returns both the validated object AND the model id that produced it so the
 * caller can record provenance in `meta.builtBy`.
 */
async function runWithFallback<S extends z.ZodTypeAny>(
  apiKey: string,
  schema: S,
  personName: string,
  text: string,
  maxOutputTokens: number,
  opts: ExtractOptions,
): Promise<{ result: z.infer<S>; model: string }> {
  const pool = opts.models && opts.models.length > 0 ? opts.models : extractModels();
  if (pool.length === 0) {
    throw new Error("Model pool is empty.");
  }
  const start = ((opts.startModelIndex ?? 0) % pool.length + pool.length) % pool.length;
  const ordered = [...pool.slice(start), ...pool.slice(0, start)];
  const temperature = opts.temperature ?? 0.2;
  const perCallTimeoutMs = opts.perCallTimeoutMs ?? DEFAULT_PER_CALL_TIMEOUT_MS;

  let lastError: unknown;
  for (let i = 0; i < ordered.length; i++) {
    const modelId = ordered[i];
    opts.onAttempt?.({ kind: "start", model: modelId, index: i, total: ordered.length });

    // Compose caller's signal with a fresh per-call timeout.
    const timeoutSignal = AbortSignal.timeout(perCallTimeoutMs);
    const signal = composeSignals([opts.signal, timeoutSignal]);

    try {
      const result = await callOnce(
        apiKey,
        modelId,
        schema,
        personName,
        text,
        temperature,
        maxOutputTokens,
        signal,
      );
      opts.onAttempt?.({ kind: "success", model: modelId, index: i, total: ordered.length });
      return { result, model: modelId };
    } catch (err) {
      lastError = err;
      const errMessage = err instanceof Error ? err.message : String(err);
      opts.onAttempt?.({
        kind: "failure",
        model: modelId,
        index: i,
        total: ordered.length,
        error: errMessage,
      });
      // Caller-aborted (route shutdown / client disconnect) — stop walking.
      if (opts.signal?.aborted) throw err;
      if (!isFallbackableError(err)) throw err;
      // Otherwise: try next model.
    }
  }

  throw new Error(
    `LLM call failed across all ${ordered.length} model(s) in the fallback list. ` +
      `Last error: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
  );
}

/**
 * Per-chunk extraction (used by the chunked + merge path).
 *
 * Returns just the validated object for backwards compatibility; the model
 * provenance is discarded since chunked builds aggregate models in `meta`.
 */
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
  const { result } = await runWithFallback(
    apiKey,
    ExtractionSchema,
    personName,
    chunkText,
    4000,
    opts,
  );
  return result;
}

/**
 * Single-call full-corpus extraction (used by the typical small-corpus path).
 *
 * Uses the wider FullCorpusPersonaSchema so the persona has merge-quality
 * depth (15-30 vocabulary, 20-30 examples, etc.) without running the merge
 * stage. Returns both the persona and the model id for `meta.builtBy`.
 */
export async function extractFullCorpusPersona(
  personName: string,
  text: string,
  opts: ExtractOptions = {},
): Promise<{ persona: FullCorpusPersona; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  const { result, model } = await runWithFallback(
    apiKey,
    FullCorpusPersonaSchema,
    personName,
    text,
    8000,
    opts,
  );
  return { persona: result, model };
}
