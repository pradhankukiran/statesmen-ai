/**
 * Centralised LLM model identifiers.
 *
 * Each constant is sourced from the environment first, falling back to a
 * sensible default. Resolved once at module load — env is set at server
 * start, not mutated mid-process.
 *
 * Override in `.env.local` to swap providers/models without code changes:
 *
 *   OPENROUTER_EXTRACT_MODEL=anthropic/claude-sonnet-4.5
 *   OPENROUTER_MERGE_MODEL=anthropic/claude-opus-4.5
 *   GROQ_CHAT_MODEL=llama-3.3-70b-versatile
 */

// Per-chunk style extraction (offline, quality-sensitive).
export const EXTRACT_MODEL: string =
  process.env.OPENROUTER_EXTRACT_MODEL ?? "anthropic/claude-sonnet-4.5";

// Reduce N chunk extractions to one consolidated persona. Defaults to the
// extract model so a single override changes both stages, but can be set
// independently for callers that want a bigger reasoner here.
export const MERGE_MODEL: string =
  process.env.OPENROUTER_MERGE_MODEL ?? EXTRACT_MODEL;

// Realtime chat with the persona (latency-sensitive).
export const CHAT_MODEL: string =
  process.env.GROQ_CHAT_MODEL ?? "llama-3.3-70b-versatile";
