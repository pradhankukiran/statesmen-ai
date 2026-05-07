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

function splitOversizedParagraph(text: string, max: number): string[] {
  const sentences = text.split(SENTENCE_BOUNDARY);
  const out: string[] = [];
  let current = "";
  let currentTokens = 0;
  for (const s of sentences) {
    const t = countTokens(s);
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

  return chunks;
}
