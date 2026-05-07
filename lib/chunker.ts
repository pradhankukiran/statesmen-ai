import { getEncoding } from "js-tiktoken";

// cl100k_base is GPT-4's encoding. It slightly over-counts for Claude (a
// reasonable safety margin for chunking) and is fast on cold start.
const enc = getEncoding("cl100k_base");

export function countTokens(text: string): number {
  return enc.encode(text).length;
}

export type ChunkOptions = {
  /** Max tokens per chunk. Default 8000 — comfortable for one extraction pass. */
  maxTokens?: number;
  /**
   * If a single paragraph alone exceeds maxTokens, split it by sentence
   * boundaries to keep chunks bounded. Default true.
   */
  splitOversized?: boolean;
};

const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-Z"'“‘])/;

/**
 * Hard-slice a string into pieces of at most `max` tokens by encoding to
 * tokens and slicing the token array. Used as a last resort when sentence
 * splitting still leaves a single "sentence" (or a paragraph with no
 * detectable sentence boundaries) over the per-chunk budget.
 */
function hardSliceByTokens(text: string, max: number): string[] {
  const tokens = enc.encode(text);
  if (tokens.length <= max) return [text];
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i += max) {
    out.push(enc.decode(tokens.slice(i, i + max)));
  }
  return out;
}

function splitOversizedParagraph(text: string, max: number): string[] {
  const sentences = text.split(SENTENCE_BOUNDARY);
  const out: string[] = [];
  let current = "";
  let currentTokens = 0;
  for (const s of sentences) {
    const t = countTokens(s);
    // Single sentence already over budget — hard-slice it by tokens. Flush
    // any in-flight `current` first so ordering is preserved.
    if (t > max) {
      if (current) {
        out.push(current);
        current = "";
        currentTokens = 0;
      }
      out.push(...hardSliceByTokens(s, max));
      continue;
    }
    if (current && currentTokens + t > max) {
      out.push(current);
      current = s;
      currentTokens = t;
    } else {
      current = current ? `${current} ${s}` : s;
      currentTokens += t;
    }
  }
  if (current) out.push(current);
  return out;
}

/**
 * Split a long string into token-bounded chunks, preferring paragraph
 * boundaries (`\n\n`). If a single paragraph exceeds `maxTokens`, it is
 * further split by sentence boundaries (when `splitOversized` is true,
 * the default).
 */
export function chunkByTokens(text: string, opts: ChunkOptions = {}): string[] {
  const max = opts.maxTokens ?? 8000;
  const split = opts.splitOversized ?? true;

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = countTokens(para);

    if (paraTokens > max && split) {
      if (current) {
        chunks.push(current);
        current = "";
        currentTokens = 0;
      }
      chunks.push(...splitOversizedParagraph(para, max));
      continue;
    }

    if (current && currentTokens + paraTokens > max) {
      chunks.push(current);
      current = para;
      currentTokens = paraTokens;
    } else {
      current = current ? `${current}\n\n${para}` : para;
      currentTokens += paraTokens;
    }
  }

  if (current) chunks.push(current);

  // Final guard: nothing leaves this function over `max`. Pathological
  // inputs (e.g. paragraph splitting succeeded but a glued accumulator
  // somehow exceeded budget, or `splitOversized` was disabled) get a hard
  // token-level slice as the last line of defence.
  if (split) {
    const guarded: string[] = [];
    for (const c of chunks) {
      if (countTokens(c) > max) {
        guarded.push(...hardSliceByTokens(c, max));
      } else {
        guarded.push(c);
      }
    }
    return guarded;
  }

  return chunks;
}
