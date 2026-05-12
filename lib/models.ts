/**
 * Centralised LLM model identifiers and fallback lists.
 *
 * IMPORTANT: these are functions, not constants. Module-level constants
 * capture `process.env` at import time, which silently breaks both
 * Next.js dev "Reload env" (the module is already loaded) and CLI scripts
 * that call `process.loadEnvFile()` after imports. Reading env at call
 * time avoids both traps.
 *
 * ─── Build pipeline (extract + merge) provider order ─────────────────────────
 *
 *   1. Modal-hosted Qwen3.6-27B (llama.cpp, OpenAI-compatible)  — preferred
 *      when MODAL_LLAMA_URL + MODAL_LLAMA_API_KEY are set.
 *   2. Groq primary (gpt-oss-120b)
 *   3. Groq fallback (llama-4-scout)
 *
 * The orchestrator walks this list on transient/rate-limit/parse failures
 * (see isFallbackableError below). Chat streaming has its own resolver
 * (`chatModel`) — unchanged.
 *
 * ─── Groq overrides (highest priority first, within Groq tier) ───────────────
 *
 *   1. GROQ_EXTRACT_MODELS / GROQ_MERGE_MODELS  (per-stage list)
 *   2. GROQ_EXTRACT_MODEL  / GROQ_MERGE_MODEL   (per-stage single)
 *   3. GROQ_MODELS                              (master list)
 *   4. baked-in default                         (gpt-oss-120b + llama-4-scout)
 *
 * Lists are comma-separated.
 *
 *   GROQ_MODELS=openai/gpt-oss-120b,meta-llama/llama-4-scout-17b-16e-instruct
 */

import type { LanguageModel } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Models verified to support Groq's `response_format: json_schema` mode (which
// the AI SDK `generateObject` uses). Llama 3.x and Qwen3 on Groq currently
// reject json_schema — keep them off this list. See:
//   https://console.groq.com/docs/structured-outputs#supported-models
const GROQ_EXTRACT_DEFAULTS = [
  "openai/gpt-oss-120b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
];
// Chat streaming uses plain JSON-free text, so any Groq chat model works.
const GROQ_CHAT_DEFAULT = "llama-3.3-70b-versatile";

// Default Modal model name; overridable via MODAL_LLAMA_MODEL.
const MODAL_DEFAULT_MODEL = "qwen3.6-27b";

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function groqMasterList(): string[] {
  const list = parseList(process.env.GROQ_MODELS);
  if (list.length > 0) return list;
  return GROQ_EXTRACT_DEFAULTS;
}

function groqExtractList(): string[] {
  const list = parseList(process.env.GROQ_EXTRACT_MODELS);
  if (list.length > 0) return list;
  const single = process.env.GROQ_EXTRACT_MODEL;
  if (single && single.trim().length > 0) return [single.trim()];
  return groqMasterList();
}

function groqMergeList(): string[] {
  const list = parseList(process.env.GROQ_MERGE_MODELS);
  if (list.length > 0) return list;
  const single = process.env.GROQ_MERGE_MODEL;
  if (single && single.trim().length > 0) return [single.trim()];
  return groqMasterList();
}

// ─── Provider factories ───────────────────────────────────────────────────────

/**
 * Build a LanguageModel for the Modal-hosted Qwen llama.cpp server.
 * Returns null if Modal env vars aren't set (so the resolver can skip the
 * Modal tier and fall straight to Groq).
 *
 * Notes:
 *   • Reads env at call time, not at import, so dev "Reload env" and CLI
 *     scripts that call process.loadEnvFile() post-import see fresh values.
 *   • `supportsStructuredOutputs: true` makes the AI SDK send
 *     `response_format: { type: "json_schema", json_schema: { ... } }` rather
 *     than inlining the schema in the prompt. llama.cpp's OpenAI shim compiles
 *     the schema to a GBNF grammar and grammar-constrains generation, which
 *     is the only reliable way to make Qwen emit Zod-parseable JSON. Without
 *     this, prompted-JSON output regularly fails to parse on the extract
 *     schema and the walk falls through to Groq.
 */
export function modalLanguageModel(): LanguageModel | null {
  const baseURL = process.env.MODAL_LLAMA_URL?.trim();
  const apiKey = process.env.MODAL_LLAMA_API_KEY?.trim();
  if (!baseURL || !apiKey) return null;
  const modelId = (process.env.MODAL_LLAMA_MODEL?.trim() || MODAL_DEFAULT_MODEL);
  // Strip a trailing slash on baseURL so we always emit `${base}/v1/...`.
  const trimmed = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;
  const provider = createOpenAICompatible({
    name: "modal",
    baseURL: `${trimmed}/v1`,
    apiKey,
  });
  return provider.languageModel(modelId, { supportsStructuredOutputs: true });
}

/** Build a Groq LanguageModel for the given model id. Throws if no key set. */
export function groqLanguageModel(modelId: string): LanguageModel {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  const groq = createGroq({ apiKey });
  return groq(modelId);
}

// ─── Entry-based resolvers for the build pipeline ─────────────────────────────

/**
 * One step in the build-pipeline fallback list. The orchestrator iterates
 * these in order, calling `getLanguageModel()` lazily so a missing Modal
 * config doesn't crash the resolver — Modal entries are simply skipped at
 * list-build time when env isn't set.
 *
 * `provider` is consumed by the extractor/merger to distinguish Modal-vs-Groq
 * success (Modal success triggers `recordModalActivity()` for GPU warm-state
 * tracking; Groq success does not).
 *
 * `modelId` is the value written into `meta.builtBy.model` and surfaced in
 * structured logs. For Modal entries it carries a `modal/` prefix so the
 * provenance is visible in cached personas without consulting `provider`.
 */
export type LlmModelEntry = {
  provider: "modal" | "groq";
  modelId: string;
  getLanguageModel: () => LanguageModel;
};

const MODAL_ID_PREFIX = "modal/";

/** True if a string id looks like one produced by a Modal entry. */
export function isModalModelId(id: string): boolean {
  return id.startsWith(MODAL_ID_PREFIX);
}

function modalEntry(): LlmModelEntry | null {
  // Cheap env probe first to avoid throwing later. The actual LanguageModel
  // is materialised lazily inside getLanguageModel() so each retry within
  // the fallback walk gets a fresh instance (matching how the prior Groq
  // path created a fresh createGroq() per call).
  if (!process.env.MODAL_LLAMA_URL?.trim()) return null;
  if (!process.env.MODAL_LLAMA_API_KEY?.trim()) return null;
  const modelId = (process.env.MODAL_LLAMA_MODEL?.trim() || MODAL_DEFAULT_MODEL);
  return {
    provider: "modal",
    modelId: `${MODAL_ID_PREFIX}${modelId}`,
    getLanguageModel: () => {
      const m = modalLanguageModel();
      if (m === null) {
        // Env disappeared between probe and call — surface a clean error
        // that the fallback walk will treat as non-fallbackable so we bail
        // out instead of silently looping. Shouldn't happen in practice.
        throw new Error("Modal env vars unset at call time.");
      }
      return m;
    },
  };
}

function groqEntries(ids: string[]): LlmModelEntry[] {
  return ids.map((modelId) => ({
    provider: "groq" as const,
    modelId,
    getLanguageModel: () => groqLanguageModel(modelId),
  }));
}

/**
 * Per-chunk style extraction fallback list. Ordered: Modal first (when
 * configured), then the Groq fallback list.
 */
export function extractModelEntries(): LlmModelEntry[] {
  const entries: LlmModelEntry[] = [];
  const m = modalEntry();
  if (m !== null) entries.push(m);
  entries.push(...groqEntries(groqExtractList()));
  return entries;
}

/**
 * Merge-stage fallback list. Same Modal-first ordering as extract.
 */
export function mergeModelEntries(): LlmModelEntry[] {
  const entries: LlmModelEntry[] = [];
  const m = modalEntry();
  if (m !== null) entries.push(m);
  entries.push(...groqEntries(groqMergeList()));
  return entries;
}

/**
 * Back-compat string-only view of extract fallback list. Returns model ids
 * in the same order as `extractModelEntries()`. Modal entries carry the
 * `modal/` prefix.
 */
export function extractModels(): string[] {
  return extractModelEntries().map((e) => e.modelId);
}

/**
 * Back-compat string-only view of merge fallback list.
 */
export function mergeModels(): string[] {
  return mergeModelEntries().map((e) => e.modelId);
}

// Realtime chat with the persona (latency-sensitive). Single model only —
// streaming chat can't transparently fail over mid-response. Groq-only.
export function chatModel(): string {
  return process.env.GROQ_CHAT_MODEL ?? GROQ_CHAT_DEFAULT;
}

// ─── Failure classification ───────────────────────────────────────────────────

/**
 * Walk the full `cause` chain looking for an abort or timeout. If ANY link in
 * the chain is an `AbortError`/`TimeoutError`, the outer error is not
 * fallbackable — the caller (Vercel function timeout, client disconnect, route
 * shutdown) asked us to stop.
 *
 * This matters because the AI SDK wraps upstream errors as `AI_APICallError`
 * with the real cause one level deep — e.g. a per-call 60s timeout surfaces
 * as `AI_APICallError { cause: AbortError }`. Detecting only the outer name
 * would let such timeouts walk the entire fallback list and burn the whole
 * function-timeout budget.
 */
function isAbortOrTimeoutChain(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;
  const e = err as { name?: unknown; cause?: unknown };
  if (typeof e.name === "string") {
    // AbortError ONLY: signals a deliberate cancellation from the caller side
    // (client disconnect, global deadline signal aborting, etc.) — don't
    // walk the fallback list. TimeoutError from AbortSignal.timeout is NOT
    // included here on purpose: that's the per-attempt timeout, the whole
    // reason the fallback list exists. The orchestrator's explicit
    // `if (opts.signal?.aborted) throw err;` check is what stops walks on
    // global-deadline TimeoutError — by then opts.signal is aborted.
    if (e.name === "AbortError") return true;
  }
  if (e.cause && typeof e.cause === "object") {
    return isAbortOrTimeoutChain(e.cause);
  }
  return false;
}

/**
 * Whether an LLM error is worth retrying against the next model in the
 * fallback list. Conservative: anything that looks like rate-limiting,
 * upstream provider failure, or a transient backend issue qualifies.
 * Schema/validation errors do NOT — those repeat regardless of model.
 */
export function isFallbackableError(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;

  // Step 1: walk the entire cause chain looking for abort/timeout. This MUST
  // run before any positive-return branch below, because the AI SDK wraps
  // aborted upstream calls as `AI_APICallError { cause: AbortError }` and the
  // outer name would otherwise be classified as fallbackable.
  if (isAbortOrTimeoutChain(err)) return false;

  // Step 2: standard fallback-eligible classification on the outer error,
  // with a final cause-unwrap for nested transient failures (ECONNRESET, etc.)
  // that didn't include an abort/timeout anywhere in their chain.
  const e = err as {
    statusCode?: unknown;
    message?: unknown;
    name?: unknown;
    cause?: unknown;
  };

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
      // Note: abort/timeout chains were already filtered above, so we won't
      // mis-classify a wrapped abort as fallbackable here.
      return true;
    }
  }

  // Unwrap `cause` chains: undici/fetch errors often nest the real reason
  // (ECONNRESET, etc.) one level deep. Aborts/timeouts were already filtered.
  if (e.cause && typeof e.cause === "object") {
    return isFallbackableError(e.cause);
  }

  return false;
}

// ─── Error summarisation for structured logs ──────────────────────────────────

/**
 * A flat, log-friendly view of an LLM error. Captures the outer error's
 * identifying fields plus the innermost cause's name, so a single log line
 * shows both what was thrown and what the underlying failure was.
 */
export type ErrorSummary = {
  name: string | undefined;
  message: string | undefined;
  statusCode: number | undefined;
  isFallbackable: boolean;
  causeName: string | undefined;
};

/**
 * Reduce an arbitrary thrown value to an `ErrorSummary`. Pure — no I/O, no
 * logging. Intended for `console.error({ ...summariseError(err) })` patterns
 * in the extract/merge/persona pipelines.
 */
export function summariseError(err: unknown): ErrorSummary {
  if (err === null || typeof err !== "object") {
    return {
      name: undefined,
      message: typeof err === "string" ? err : undefined,
      statusCode: undefined,
      isFallbackable: false,
      causeName: undefined,
    };
  }

  const e = err as {
    name?: unknown;
    message?: unknown;
    statusCode?: unknown;
    cause?: unknown;
  };

  return {
    name: typeof e.name === "string" ? e.name : undefined,
    message: typeof e.message === "string" ? e.message : undefined,
    statusCode: typeof e.statusCode === "number" ? e.statusCode : undefined,
    isFallbackable: isFallbackableError(err),
    causeName: innermostCauseName(err),
  };
}

function innermostCauseName(err: unknown): string | undefined {
  if (err === null || typeof err !== "object") return undefined;
  const e = err as { name?: unknown; cause?: unknown };
  if (e.cause && typeof e.cause === "object") {
    const deeper = innermostCauseName(e.cause);
    if (deeper !== undefined) return deeper;
    const causeName = (e.cause as { name?: unknown }).name;
    if (typeof causeName === "string") return causeName;
  }
  // No deeper cause — return undefined so the caller distinguishes
  // "outer error only" from "wrapped cause". The outer name is already on
  // the summary's `name` field.
  return undefined;
}
