/**
 * Centralised LLM model identifiers and fallback lists.
 *
 * IMPORTANT: these are functions, not constants. Module-level constants
 * capture `process.env` at import time, which silently breaks both
 * Next.js dev "Reload env" (the module is already loaded) and CLI scripts
 * that call `process.loadEnvFile()` after imports. Reading env at call
 * time avoids both traps.
 *
 * ─── OpenRouter overrides (highest priority first) ────────────────────────────
 *
 *   1. OPENROUTER_EXTRACT_MODELS / OPENROUTER_MERGE_MODELS  (per-stage list)
 *   2. OPENROUTER_EXTRACT_MODEL  / OPENROUTER_MERGE_MODEL   (per-stage single)
 *   3. OPENROUTER_MODELS                                    (master list)
 *   4. OPENROUTER_MODEL                                     (master single)
 *   5. baked-in default                                     (claude-sonnet-4.5)
 *
 * Lists are comma-separated. The pipeline tries each model in order; if a
 * call fails with a transient/rate-limit error, the next model is tried.
 *
 *   OPENROUTER_MODELS=nvidia/nemotron-3-super-120b-a12b:free,qwen/qwen3-next-80b-a3b-instruct:free,nvidia/nemotron-nano-9b-v2:free
 */

const OPENROUTER_DEFAULT = "anthropic/claude-sonnet-4.5";
const GROQ_DEFAULT = "llama-3.3-70b-versatile";

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function openrouterMasterList(): string[] {
  const list = parseList(process.env.OPENROUTER_MODELS);
  if (list.length > 0) return list;
  const single = process.env.OPENROUTER_MODEL;
  if (single && single.trim().length > 0) return [single.trim()];
  return [OPENROUTER_DEFAULT];
}

// Per-chunk style extraction (offline, quality-sensitive). Returns an
// ordered fallback list — first entry is preferred, later entries are
// tried only if earlier ones return transient/rate-limit errors.
export function extractModels(): string[] {
  const list = parseList(process.env.OPENROUTER_EXTRACT_MODELS);
  if (list.length > 0) return list;
  const single = process.env.OPENROUTER_EXTRACT_MODEL;
  if (single && single.trim().length > 0) return [single.trim()];
  return openrouterMasterList();
}

// Reduce N chunk extractions to one consolidated persona. Same fallback
// semantics as extractModels.
export function mergeModels(): string[] {
  const list = parseList(process.env.OPENROUTER_MERGE_MODELS);
  if (list.length > 0) return list;
  const single = process.env.OPENROUTER_MERGE_MODEL;
  if (single && single.trim().length > 0) return [single.trim()];
  return openrouterMasterList();
}

// Realtime chat with the persona (latency-sensitive). Single model only —
// streaming chat can't transparently fail over mid-response.
export function chatModel(): string {
  return process.env.GROQ_CHAT_MODEL ?? GROQ_DEFAULT;
}

// ─── Failure classification ───────────────────────────────────────────────────

/**
 * Whether an LLM error is worth retrying against the next model in the
 * fallback list. Conservative: anything that looks like rate-limiting,
 * upstream provider failure, or a transient backend issue qualifies.
 * Schema/validation errors do NOT — those repeat regardless of model.
 */
export function isFallbackableError(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;

  const e = err as {
    statusCode?: unknown;
    message?: unknown;
    name?: unknown;
    cause?: unknown;
  };

  // Aborts are NOT fallbackable: they signal the caller asked us to stop
  // (Vercel function timeout, client disconnect, route shutdown). Walking the
  // fallback list after an abort wastes the rest of the timeout budget on
  // calls that will themselves abort.
  if (typeof e.name === "string" && e.name === "AbortError") return false;
  if (typeof e.name === "string" && e.name === "TimeoutError") return false;

  if (typeof e.statusCode === "number") {
    if (e.statusCode === 402) return true; // out of credits — try cheaper/free model
    if (e.statusCode === 408) return true; // request timeout
    if (e.statusCode === 413) return true; // payload too large — try a larger-context model
    if (e.statusCode === 429) return true; // rate limited
    if (e.statusCode >= 500 && e.statusCode < 600) return true; // backend
  }

  const message =
    typeof e.message === "string" ? e.message.toLowerCase() : "";
  if (message.length > 0) {
    if (message.includes("rate limit")) return true;
    if (message.includes("rate-limited")) return true;
    if (message.includes("provider returned error")) return true;
    if (message.includes("temporarily")) return true;
    if (message.includes("overloaded")) return true;
    if (message.includes("upstream")) return true;
    if (message.includes("no endpoints found")) return true;
    if (message.includes("fewer max_tokens")) return true;
    // Bare undici-level connection errors don't carry a statusCode and
    // surface as `TypeError: fetch failed`. Worth trying the next provider.
    if (message.includes("fetch failed")) return true;
    if (message.includes("econnreset")) return true;
    if (message.includes("etimedout")) return true;
    if (message.includes("enotfound")) return true;
    if (message.includes("socket hang up")) return true;
    // The AI SDK throws "No object generated: could not parse the response."
    // when a model returns structured output that fails Zod validation
    // (truncated JSON, mixed-in reasoning text, etc.). Different models
    // have different structured-output reliability, so worth trying the
    // next one.
    if (message.includes("no object generated")) return true;
    if (message.includes("could not parse the response")) return true;
  }

  // The AI SDK marks specific error classes via Symbol(vercel.ai.error).
  // We can also detect by name string.
  if (typeof e.name === "string") {
    if (e.name === "AI_NoObjectGeneratedError") return true;
    if (e.name === "AI_RetryError") return true;
    if (e.name === "AI_APICallError" && (e.statusCode === undefined || e.statusCode === 0)) {
      // Upstream connection-level failure (DNS, reset, etc.) — worth retrying.
      return true;
    }
  }

  // Unwrap `cause` chains: undici/fetch errors often nest the real reason
  // (ECONNRESET, AbortError, etc.) one level deep.
  if (e.cause && typeof e.cause === "object") {
    return isFallbackableError(e.cause);
  }

  return false;
}
