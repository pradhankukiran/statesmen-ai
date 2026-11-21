/**
 * Wake the Modal embedding service by calling its health endpoint, so the
 * first build or chat reply doesn't pay the ~15s cold start.
 */

import { recordEmbedActivity, recordWarmupStarted } from "@/lib/warmup-state";

// A cold start takes ~15s; wait up to 120s on the upstream fetch in case Modal
// is slow to find a GPU, and pad the function's own maxDuration above that.
export const dynamic = "force-dynamic";
export const maxDuration = 130;

const MODAL_FETCH_TIMEOUT_MS = 120_000;
const RECORD_TIMEOUT_MS = 2_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

/**
 * Cap the wait on the `recordWarmupStarted` database write. Storage hiccups
 * must not delay the hot path; the recorder itself swallows errors, so all
 * we need to enforce here is a wall-clock budget.
 */
async function withBudget<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(): Promise<Response> {
  const baseUrl = process.env.EMBED_URL;
  const apiKey = process.env.EMBED_API_KEY;

  if (!baseUrl || baseUrl.trim().length === 0) {
    return Response.json(
      { status: "error", error: "EMBED_URL is not set." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
  if (!apiKey || apiKey.trim().length === 0) {
    return Response.json(
      { status: "error", error: "EMBED_API_KEY is not set." },
      { status: 500, headers: noStoreHeaders() },
    );
  }

  // Stamp "warming" before the upstream fetch so concurrent status polls
  // see the in-flight state. Capped at 2s — database latency must never
  // delay the actual warmup request.
  await withBudget(recordWarmupStarted(), RECORD_TIMEOUT_MS);

  const target = `${baseUrl.replace(/\/+$/, "")}/health`;

  try {
    const res = await fetch(target, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(MODAL_FETCH_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        `[warmup] embedding /health non-2xx: ${res.status} ${res.statusText}`,
      );
      // Intentionally do NOT clear warmingStartedAt — let it age out via
      // WARMING_TTL_SECONDS so the UI doesn't snap back to "cold" while a
      // retry could still succeed.
      return Response.json(
        { status: "error" },
        { status: 502, headers: noStoreHeaders() },
      );
    }

    // Drain the body so the connection can be reused; ignore parse errors.
    try {
      await res.text();
    } catch {
      // Body already consumed or stream broken; the 2xx is what we care about.
    }

    await recordEmbedActivity();
    return Response.json(
      { status: "warm" },
      { status: 200, headers: noStoreHeaders() },
    );
  } catch (err) {
    console.error(
      "[warmup] embedding /health fetch failed:",
      err instanceof Error ? err.message : err,
    );
    return Response.json(
      { status: "error" },
      { status: 502, headers: noStoreHeaders() },
    );
  }
}
