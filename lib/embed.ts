/**
 * Client for the Modal-hosted embedding service (infra/embed.py).
 *
 * Qwen3-Embedding-0.6B served by Text Embeddings Inference, called through its
 * OpenAI-compatible /v1/embeddings endpoint. Documents are embedded as-is;
 * queries get Qwen3's instruction prefix, which the model was trained with.
 */

import { z } from "zod";
import { mapWithConcurrency } from "./concurrency";

export const EMBED_MODEL = "Qwen/Qwen3-Embedding-0.6B";
export const EMBED_DIMS = 1024;

/** TEI's default --max-client-batch-size. */
const BATCH_SIZE = 32;
/** Batches in flight at once. The Modal function accepts 32 concurrent inputs. */
const CONCURRENCY = 4;
/** Generous enough to cover a ~15s cold start plus a slow batch. */
const REQUEST_TIMEOUT_MS = 120_000;

const QUERY_INSTRUCTION =
  "Given a question put to a politician, retrieve their speeches that address it";

const EmbedResponseSchema = z.object({
  data: z.array(
    z.object({
      index: z.number(),
      embedding: z.array(z.number()),
    }),
  ),
});

function serviceConfig(): { url: string; key: string } {
  const url = process.env.EMBED_URL?.trim();
  const key = process.env.EMBED_API_KEY?.trim();
  if (!url) throw new Error("EMBED_URL is not set.");
  if (!key) throw new Error("EMBED_API_KEY is not set.");
  return { url: url.replace(/\/+$/, ""), key };
}

async function embedBatch(
  texts: string[],
  signal?: AbortSignal,
): Promise<number[][]> {
  const { url, key } = serviceConfig();
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const res = await fetch(`${url}/v1/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`Embedding service returned ${res.status}: ${detail}`);
  }
  const { data } = EmbedResponseSchema.parse(await res.json());
  if (data.length !== texts.length) {
    throw new Error(
      `Embedding service returned ${data.length} vectors for ${texts.length} inputs.`,
    );
  }
  const vectors = [...data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  for (const v of vectors) {
    if (v.length !== EMBED_DIMS) {
      throw new Error(`Expected ${EMBED_DIMS}-dim embeddings, got ${v.length}.`);
    }
  }
  return vectors;
}

/** Embed documents (speeches), in input order. */
export async function embedDocuments(
  texts: string[],
  opts: { signal?: AbortSignal; onBatchDone?: (done: number, total: number) => void } = {},
): Promise<number[][]> {
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push(texts.slice(i, i + BATCH_SIZE));
  }
  let done = 0;
  const results = await mapWithConcurrency(
    batches,
    CONCURRENCY,
    async (batch, _i, signal) => {
      const vectors = await embedBatch(batch, signal);
      done += batch.length;
      opts.onBatchDone?.(done, texts.length);
      return vectors;
    },
    opts.signal,
  );
  return results.flat();
}

/** Embed a user question for searching speeches. */
export async function embedQuery(
  question: string,
  opts: { signal?: AbortSignal } = {},
): Promise<number[]> {
  const [v] = await embedBatch(
    [`Instruct: ${QUERY_INSTRUCTION}\nQuery: ${question}`],
    opts.signal,
  );
  return v;
}
