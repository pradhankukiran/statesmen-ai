/**
 * Streaming chat endpoint.
 *
 * Loads the person from Neon, finds their speeches closest in meaning to the
 * latest question (embedding search), builds a system prompt around those
 * speeches, and streams a Groq response in the persona's voice. Designed to
 * pair with the Vercel AI SDK `useChat` hook on the client.
 */

import { groq } from "@ai-sdk/groq";
import { after } from "next/server";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { chatModel } from "@/lib/models";
import { recordEmbedActivity } from "@/lib/warmup-state";
import { excerptOf, type ChatMetadata, type ReplySource } from "@/lib/chat-sources";
import { hansardDebateUrl } from "@/lib/hansard";
import { getPersonCached } from "@/lib/person-cache";
import { searchSpeeches, type StoredPerson } from "@/lib/speeches";
import {
  buildChatSystemPrompt,
  retrievalQuery,
  SPEECHES_PER_MESSAGE,
} from "@/lib/chat-prompt";

export const runtime = "nodejs";
// Streaming Groq replies are typically a few seconds, but we leave headroom
// for slow first-token starts on the free tier.
export const maxDuration = 60;

// ─── Limits ──────────────────────────────────────────────────────────────────

/**
 * Cap on history length. Long conversations have diminishing returns for
 * persona fidelity (the system prompt does the heavy lifting) and inflate
 * the prompt-injection surface area.
 */
const MAX_MESSAGE_COUNT = 50;

/**
 * Cap on a single message's text content. A 100k-char paste is almost
 * certainly an injection blob, not a question — bounce it at the door.
 */
const MAX_MESSAGE_CHARS = 4000;

// ─── Request shape ────────────────────────────────────────────────────────────

type ChatRequestBody = {
  slug: string;
  messages: UIMessage[];
};

type IncomingPart = { type?: unknown; text?: unknown };

/**
 * Extract the text content of a message regardless of whether it arrived in
 * the AI SDK `parts` shape or a legacy `content: string` shape. Mirrors the
 * `messageText` helper used on the client.
 */
function messageText(value: Record<string, unknown>): string {
  const parts = value.parts;
  if (Array.isArray(parts)) {
    return parts
      .filter(
        (p): p is IncomingPart =>
          p !== null && typeof p === "object",
      )
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("");
  }
  if (typeof value.content === "string") return value.content;
  return "";
}

/**
 * Validate one incoming message: must have a recognised role and either a
 * `parts` array (AI SDK shape) or a `content` string (legacy shape).
 * Returns null on success, or a human-readable error string on failure.
 */
function validateMessage(value: unknown, index: number): string | null {
  if (value === null || typeof value !== "object") {
    return `messages[${index}] must be an object.`;
  }
  const m = value as Record<string, unknown>;

  if (
    m.role !== "user" &&
    m.role !== "assistant" &&
    m.role !== "system"
  ) {
    return `messages[${index}].role must be 'user' | 'assistant' | 'system'.`;
  }

  const hasParts = Array.isArray(m.parts);
  const hasContent = typeof m.content === "string";
  if (!hasParts && !hasContent) {
    return `messages[${index}] must have a 'parts' array or 'content' string.`;
  }

  return null;
}

function isChatRequestBody(value: unknown): value is ChatRequestBody {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.slug !== "string") return false;
  if (!Array.isArray(v.messages)) return false;
  if (v.messages.length === 0) return false;
  return v.messages.every((m, i) => validateMessage(m, i) === null);
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

  if (body.messages.length > MAX_MESSAGE_COUNT) {
    return Response.json(
      {
        error: `Conversation too long: ${body.messages.length} messages (max ${MAX_MESSAGE_COUNT}). Start a new chat.`,
      },
      { status: 400 },
    );
  }

  // Per-message shape validation — strict role + parts/content presence.
  for (let i = 0; i < body.messages.length; i++) {
    const err = validateMessage(body.messages[i], i);
    if (err) {
      return Response.json({ error: err }, { status: 400 });
    }
  }

  // Per-message length cap. Run after shape validation so messageText() is
  // safe to call on every entry.
  for (let i = 0; i < body.messages.length; i++) {
    const m = body.messages[i] as Record<string, unknown>;
    const text = messageText(m);
    if (text.length > MAX_MESSAGE_CHARS) {
      return Response.json(
        {
          error: `messages[${i}] text exceeds ${MAX_MESSAGE_CHARS} characters (got ${text.length}).`,
        },
        { status: 400 },
      );
    }
  }

  if (!isChatRequestBody(body)) {
    return Response.json(
      { error: "Invalid request body shape." },
      { status: 400 },
    );
  }

  const { slug, messages } = body;

  let person: StoredPerson | null;
  try {
    person = await getPersonCached(slug);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown database error.";
    return Response.json(
      { error: `Persona load failed: ${message}` },
      { status: 502 },
    );
  }

  if (person === null) {
    return Response.json(
      { error: "Persona not built yet" },
      { status: 404 },
    );
  }

  // Without speeches the reply would be a generic model, not the persona, so
  // a search failure is surfaced rather than papered over.
  const query = retrievalQuery(
    messages.filter((m) => m.role === "user").map((m) => messageText(m as unknown as Record<string, unknown>)),
  );
  let speeches;
  try {
    speeches = await searchSpeeches(slug, query, SPEECHES_PER_MESSAGE, {
      signal: request.signal,
    });
  } catch (err) {
    console.error(
      "[chat] speech search failed:",
      err instanceof Error ? err.message : err,
    );
    return Response.json(
      { error: "Speech search is unavailable. Please try again." },
      { status: 503 },
    );
  }

  // Keeps the header status dot honest; runs after the response is sent.
  after(recordEmbedActivity);

  const system = buildChatSystemPrompt(person, speeches);
  const model = groq(chatModel());

  const modelMessages = await convertToModelMessages(messages);

  // Synchronous throws from streamText (auth, config, transport) should
  // surface as a clean 503 rather than an opaque 500. Most upstream issues
  // happen async inside the stream and are surfaced via the stream itself —
  // those we leave alone.
  let result: ReturnType<typeof streamText>;
  try {
    result = streamText({
      model,
      system,
      messages: modelMessages,
      // Groq's recommended Instruct-mode settings for qwen/qwen3.8-27b. Its
      // top_k=20 and min_p=0 aren't passed: the AI SDK Groq provider drops
      // topK, and min_p isn't exposed.
      temperature: 0.7,
      topP: 0.8,
      presencePenalty: 1.5,
      // Match the persona's "chamber response — focused and punchy, not
      // essays" behaviour spec. Bumped from 1500 → 2000 to give a little
      // headroom against mid-paragraph truncation, with the system-prompt
      // reinforcement above carrying the brevity contract.
      maxOutputTokens: 2000,
      // Qwen3.8 27B thinks before answering by default, and Groq's default
      // format puts that thinking inline in <think> tags. Turn it off: faster
      // first token, and no reasoning text leaking into the chat bubble.
      providerOptions: { groq: { reasoningEffort: "none" } },
      // Client disconnect / route shutdown propagates into the upstream
      // Groq call so we don't keep paying for tokens nobody will read.
      abortSignal: request.signal,
    });
  } catch (err) {
    console.error(
      "[chat] streamText failed synchronously:",
      err instanceof Error ? err.message : err,
    );
    return Response.json(
      { error: "Chat service temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }

  // The speeches behind this reply, shown under it in the chat.
  const sources: ReplySource[] = speeches.map((s) => ({
    id: s.id,
    date: s.sittingDate,
    house: s.house,
    debate: s.debateTitle?.trim() || null,
    url: hansardDebateUrl(s.house, s.sittingDate, s.debateSectionExtId, s.debateTitle),
    excerpt: excerptOf(s.text),
  }));

  return result.toUIMessageStreamResponse<UIMessage<ChatMetadata>>({
    messageMetadata: ({ part }) => (part.type === "start" ? { sources } : undefined),
  });
}
