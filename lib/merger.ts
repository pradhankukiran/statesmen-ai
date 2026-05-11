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
    .min(15)
    .max(30)
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
    .min(5)
    .max(10)
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
    .min(8)
    .max(15)
    .describe(
      "8–15 cross-cutting themes that recur across the speaker's corpus",
    ),
  openings: z
    .array(z.string())
    .min(5)
    .max(10)
    .describe("5–10 typical phrase openings used by the speaker"),
  closings: z
    .array(z.string())
    .min(5)
    .max(10)
    .describe("5–10 typical phrase closings used by the speaker"),
  examples: z
    .array(z.string())
    .min(20)
    .max(30)
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
  /** Caller's abort signal; composed with each call's timeout. */
  signal?: AbortSignal;
  /** Per-call timeout in ms. Defaults to 60s. */
  perCallTimeoutMs?: number;
};

const DEFAULT_PER_CALL_TIMEOUT_MS = 60_000;

function composeSignals(signals: (AbortSignal | undefined)[]): AbortSignal {
  const real = signals.filter((s): s is AbortSignal => s !== undefined);
  if (real.length === 0) return new AbortController().signal;
  if (real.length === 1) return real[0];
  return AbortSignal.any(real);
}

async function callOnce(
  apiKey: string,
  modelId: string,
  name: string,
  extractions: Extraction[],
  temperature: number,
  signal: AbortSignal,
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
    abortSignal: signal,
    // The merger's own fallback list handles retry; the SDK's internal
    // retries just multiply rate-limit pressure on already-throttled
    // upstreams.
    maxRetries: 0,
    // Disable hidden reasoning/chain-of-thought tokens on the merge call.
    // Same rationale as the extractor: merging is a structured
    // deduplication/synthesis task, not multi-step problem solving.
    // No-op on non-reasoning models.
    providerOptions: {
      openrouter: {
        reasoning: { enabled: false },
      },
    },
  });
  return object;
}

/**
 * Reduce N chunk extractions into one consolidated persona. Walks the
 * configured fallback list sequentially on transient failures. Returns both
 * the persona and the model id that produced it for `meta.builtBy`.
 */
export async function mergeExtractions(
  name: string,
  extractions: Extraction[],
  opts: MergeOptions = {},
): Promise<{ persona: MergedPersona; model: string }> {
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
  if (pool.length === 0) {
    throw new Error("Merge model pool is empty.");
  }
  const start = ((opts.startModelIndex ?? 0) % pool.length + pool.length) % pool.length;
  const ordered = [...pool.slice(start), ...pool.slice(0, start)];
  const temperature = opts.temperature ?? 0.3;
  const perCallTimeoutMs = opts.perCallTimeoutMs ?? DEFAULT_PER_CALL_TIMEOUT_MS;

  let lastError: unknown;
  for (const modelId of ordered) {
    const timeoutSignal = AbortSignal.timeout(perCallTimeoutMs);
    const signal = composeSignals([opts.signal, timeoutSignal]);

    try {
      const persona = await callOnce(
        apiKey,
        modelId,
        name,
        extractions,
        temperature,
        signal,
      );
      return { persona, model: modelId };
    } catch (err) {
      lastError = err;
      if (opts.signal?.aborted) throw err;
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
