/**
 * Centralised LLM model identifiers.
 *
 * IMPORTANT: these are functions, not constants. Module-level constants
 * capture `process.env` at import time, which is wrong in two ways:
 *   - Next.js dev "Reload env" doesn't re-evaluate already-loaded modules,
 *     so changes to `.env.local` are silently ignored.
 *   - CLI scripts that call `process.loadEnvFile()` after imports load
 *     the env *after* the constants were already captured.
 * Reading env at call time (per-request) avoids both traps.
 *
 * Override priority for OpenRouter (highest first):
 *
 *   1. OPENROUTER_EXTRACT_MODEL / OPENROUTER_MERGE_MODEL  (per-stage)
 *   2. OPENROUTER_MODEL                                   (master — both stages)
 *   3. baked-in default                                   (claude-sonnet-4.5)
 *
 * Simple "use one model for everything":
 *
 *   OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
 */

const OPENROUTER_DEFAULT = "anthropic/claude-sonnet-4.5";
const GROQ_DEFAULT = "llama-3.3-70b-versatile";

function openrouterFallback(): string {
  return process.env.OPENROUTER_MODEL ?? OPENROUTER_DEFAULT;
}

// Per-chunk style extraction (offline, quality-sensitive).
export function extractModel(): string {
  return process.env.OPENROUTER_EXTRACT_MODEL ?? openrouterFallback();
}

// Reduce N chunk extractions to one consolidated persona.
export function mergeModel(): string {
  return process.env.OPENROUTER_MERGE_MODEL ?? openrouterFallback();
}

// Realtime chat with the persona (latency-sensitive).
export function chatModel(): string {
  return process.env.GROQ_CHAT_MODEL ?? GROQ_DEFAULT;
}
