import {
  recordModalActivity,
  recordModalWarmupStarted,
} from "@/lib/warmup-state";

// Modal cold-start can take up to ~90s, so we wait up to 120s on the upstream
// fetch and pad the function's own maxDuration slightly above that.
export const dynamic = "force-dynamic";
export const maxDuration = 130;

const MODAL_FETCH_TIMEOUT_MS = 120_000;
const RECORD_TIMEOUT_MS = 2_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

/**
 * Cap the wait on a `recordModalWarmupStarted` Blob write. Storage hiccups
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
  const baseUrl = process.env.MODAL_LLAMA_URL;
  const apiKey = process.env.MODAL_LLAMA_API_KEY;

  if (!baseUrl || baseUrl.trim().length === 0) {
    return Response.json(
      { status: "error", error: "MODAL_LLAMA_URL is not set." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
  if (!apiKey || apiKey.trim().length === 0) {
    return Response.json(
      { status: "error", error: "MODAL_LLAMA_API_KEY is not set." },
      { status: 500, headers: noStoreHeaders() },
    );
  }

  // Stamp "warming" before the upstream fetch so concurrent status polls
  // see the in-flight state. Capped at 2s — Blob latency must never delay
  // the actual warmup request.
  await withBudget(recordModalWarmupStarted(), RECORD_TIMEOUT_MS);

  const target = `${baseUrl.replace(/\/+$/, "")}/warmup`;

  try {
    const res = await fetch(target, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(MODAL_FETCH_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        `[warmup] Modal /warmup non-2xx: ${res.status} ${res.statusText}`,
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

    await recordModalActivity();
    return Response.json(
      { status: "warm" },
      { status: 200, headers: noStoreHeaders() },
    );
  } catch (err) {
    console.error(
      "[warmup] Modal /warmup fetch failed:",
      err instanceof Error ? err.message : err,
    );
    return Response.json(
      { status: "error" },
      { status: 502, headers: noStoreHeaders() },
    );
  }
}
