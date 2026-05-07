/**
 * Streaming chat endpoint.
 *
 * Loads a cached persona by slug, builds a system prompt from `persona.md`
 * plus a randomly-sampled few-shot block of verbatim quotes, and streams a
 * Groq Llama response in the persona's voice. Designed to pair with the
 * Vercel AI SDK `useChat` hook on the client.
 */

import { groq } from "@ai-sdk/groq";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { CHAT_MODEL } from "@/lib/models";
import { getPersona, type CachedPersona } from "@/lib/cache";
import type { PersonaExamplesFile } from "@/lib/persona";

export const runtime = "nodejs";

// ─── Request shape ────────────────────────────────────────────────────────────

type ChatRequestBody = {
  slug: string;
  messages: UIMessage[];
};

function isChatRequestBody(value: unknown): value is ChatRequestBody {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.slug !== "string") return false;
  if (!Array.isArray(v.messages)) return false;
  if (v.messages.length === 0) return false;
  return v.messages.every((m) => m !== null && typeof m === "object");
}

// ─── System prompt assembly ──────────────────────────────────────────────────

const EXAMPLE_COUNT = 8;

function sampleExamples(
  examples: PersonaExamplesFile,
  count: number,
): string[] {
  const pool = examples.examples;
  if (pool.length <= count) return [...pool];
  // Fisher–Yates partial shuffle: produce `count` distinct random picks.
  const copy = [...pool];
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function buildSystemPrompt(cached: CachedPersona): string {
  const sampled = sampleExamples(cached.examples, EXAMPLE_COUNT);
  if (sampled.length === 0) return cached.md;

  const block = sampled.map((q) => `- "${q}"`).join("\n");
  return `${cached.md}

## Real examples of how you speak
${block}
`;
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return Response.json(
      { error: "GROQ_API_KEY not configured" },
      { status: 500 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!raw || typeof raw !== "object") {
    return Response.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  const body = raw as Record<string, unknown>;

  if (typeof body.slug !== "string" || body.slug.trim().length === 0) {
    return Response.json(
      { error: "'slug' is required." },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json(
      { error: "'messages' must be a non-empty array." },
      { status: 400 },
    );
  }

  if (!isChatRequestBody(body)) {
    return Response.json(
      { error: "Invalid request body shape." },
      { status: 400 },
    );
  }

  const { slug, messages } = body;

  let cached: CachedPersona | null;
  try {
    cached = await getPersona(slug);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown cache error.";
    return Response.json(
      { error: `Persona load failed: ${message}` },
      { status: 502 },
    );
  }

  if (cached === null) {
    return Response.json(
      { error: "Persona not built yet" },
      { status: 404 },
    );
  }

  const system = buildSystemPrompt(cached);
  const model = groq(CHAT_MODEL);

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model,
    system,
    messages: modelMessages,
    temperature: 0.7,
  });

  return result.toUIMessageStreamResponse();
}
