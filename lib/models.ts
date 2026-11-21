/**
 * Chat model identifier.
 *
 * A function, not a constant: module-level constants capture `process.env` at
 * import time, which breaks Next.js dev "Reload env" and CLI scripts that call
 * `process.loadEnvFile()` after imports.
 */

// Groq, with thinking turned off in the chat route (reasoningEffort "none").
const GROQ_CHAT_DEFAULT = "qwen/qwen3.8-27b";

/** Streaming chat model. Override with GROQ_CHAT_MODEL. */
export function chatModel(): string {
  return process.env.GROQ_CHAT_MODEL?.trim() || GROQ_CHAT_DEFAULT;
}
