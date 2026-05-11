import { getPersona, hasPersona, setPersona } from "@/lib/cache";
import {
  buildPersona,
  type BuildEvent,
  type FetchConfig,
  type PersonaMeta,
} from "@/lib/persona";

export const runtime = "nodejs";
// Vercel Hobby plan caps Serverless Function maxDuration at 300s. With the
// per-call 60s timeout × 5-model fallback × extract (+ optional merge)
// stages, builds that need many fallback hops may run up against this; in
// practice the typical cold build finishes well inside 300s.
export const maxDuration = 300;

// Global build deadline = 90% of `maxDuration` so we keep ~30s of headroom
// to write a clean SSE error and close the stream before Vercel forcibly
// kills the function with an opaque 504. The deadline is propagated as an
// AbortSignal into every LLM call so the fallback walk terminates
// promptly once the budget is exhausted.
const BUILD_DEADLINE_MS = Math.floor(maxDuration * 1000 * 0.9);

// ─── Request schema ───────────────────────────────────────────────────────────

type BuildRequestBody = {
  slug?: unknown;
  name?: unknown;
  memberId?: unknown;
  attribution?: unknown;
  max?: unknown;
};

type AttributionInput = {
  label: string;
  startDate: string;
  endDate: string;
  searchTerms?: string[];
};

type ParsedRequest = {
  slug: string;
  name: string;
  fetch: FetchConfig;
};

const DEFAULT_MAX = 500;

// ─── SSE event union ──────────────────────────────────────────────────────────

type SseEvent =
  | BuildEvent
  | { type: "ready"; cached: true }
  | { type: "ready"; cached: false; meta: PersonaMeta }
  | { type: "error"; message: string }
  | { type: "ping" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function parseAttribution(raw: unknown): AttributionInput | string {
  if (raw === null || typeof raw !== "object") {
    return "'attribution' must be an object.";
  }
  const a = raw as Record<string, unknown>;
  if (!isNonEmptyString(a.label)) {
    return "'attribution.label' must be a non-empty string.";
  }
  if (!isIsoDate(a.startDate)) {
    return "'attribution.startDate' must be a YYYY-MM-DD string.";
  }
  if (!isIsoDate(a.endDate)) {
    return "'attribution.endDate' must be a YYYY-MM-DD string.";
  }
  let searchTerms: string[] | undefined;
  if (a.searchTerms !== undefined) {
    if (
      !Array.isArray(a.searchTerms) ||
      !a.searchTerms.every((t): t is string => isNonEmptyString(t))
    ) {
      return "'attribution.searchTerms' must be an array of non-empty strings.";
    }
    searchTerms = a.searchTerms;
  }
  return {
    label: a.label.trim(),
    startDate: a.startDate,
    endDate: a.endDate,
    searchTerms,
  };
}

function parseRequest(body: BuildRequestBody): ParsedRequest | string {
  if (!isNonEmptyString(body.slug)) {
    return "'slug' is required.";
  }
  if (!isNonEmptyString(body.name)) {
    return "'name' is required.";
  }

  const hasMemberId = body.memberId !== undefined && body.memberId !== null;
  const hasAttribution =
    body.attribution !== undefined && body.attribution !== null;

  if (hasMemberId === hasAttribution) {
    return "Exactly one of 'memberId' or 'attribution' must be provided.";
  }

  let max: number = DEFAULT_MAX;
  if (body.max !== undefined && body.max !== null) {
    if (!isPositiveInt(body.max)) {
      return "'max' must be a positive integer.";
    }
    max = body.max;
  }

  if (hasMemberId) {
    if (!isPositiveInt(body.memberId)) {
      return "'memberId' must be a positive integer.";
    }
    return {
      slug: body.slug.trim(),
      name: body.name.trim(),
      fetch: { kind: "memberId", memberId: body.memberId, max },
    };
  }

  const attribution = parseAttribution(body.attribution);
  if (typeof attribution === "string") return attribution;

  return {
    slug: body.slug.trim(),
    name: body.name.trim(),
    fetch: {
      kind: "attribution",
      label: attribution.label,
      startDate: attribution.startDate,
      endDate: attribution.endDate,
      searchTerms: attribution.searchTerms,
      max,
    },
  };
}

// ─── In-process slug-keyed lock ───────────────────────────────────────────────
//
// Two concurrent builds for the same slug on a warm function instance would
// otherwise each spend the full LLM budget and race on the cache write. The
// lock serialises them so the second call short-circuits on cache hit after
// the first commits. (Best-effort: doesn't span instances; for full
// cross-instance dedup, use Vercel KV with setIfNotExists. Out of scope.)

const buildLocks = new Map<string, Promise<void>>();

async function withSlugLock<T>(
  slug: string,
  fn: () => Promise<T>,
): Promise<T> {
  const existing = buildLocks.get(slug);
  if (existing) {
    // Wait for the in-flight build to finish (success or failure) before
    // we proceed; ignore its failure since we'll re-check the cache.
    await existing.catch(() => undefined);
  }
  let release!: () => void;
  const lock = new Promise<void>((res) => {
    release = res;
  });
  buildLocks.set(slug, lock);
  try {
    return await fn();
  } finally {
    release();
    // Only delete if our lock is still the registered one (defensive).
    if (buildLocks.get(slug) === lock) {
      buildLocks.delete(slug);
    }
  }
}

// ─── SSE plumbing ─────────────────────────────────────────────────────────────

function encodeEvent(encoder: TextEncoder, event: SseEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (raw === null || typeof raw !== "object") {
    return Response.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  const parsed = parseRequest(raw as BuildRequestBody);
  if (typeof parsed === "string") {
    return Response.json({ error: parsed }, { status: 400 });
  }

  const { slug, name, fetch: fetchConfig } = parsed;

  const encoder = new TextEncoder();
  // Capture the request's abort signal so it can be threaded into every
  // downstream LLM call and cancel in-flight work when the client
  // disconnects.
  const requestSignal = request.signal;
  // Separate deadline signal: fires at ~90% of maxDuration so we can write
  // a clean SSE error and close the stream before Vercel forcibly kills
  // the function. Kept distinct from `requestSignal` so the client-
  // disconnect path and the deadline path are independently observable.
  const deadlineSignal = AbortSignal.timeout(BUILD_DEADLINE_MS);
  // Composite signal threaded into `buildPersona`. Either client
  // disconnect or deadline-fire aborts every in-flight LLM call via the
  // extractor/merger's `AbortSignal.any([opts.signal, perCallTimeout])`
  // composition.
  const compositeSignal: AbortSignal = AbortSignal.any([
    requestSignal,
    deadlineSignal,
  ]);
  const requestStartMs = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let pingTimer: ReturnType<typeof setInterval> | null = null;

      const send = (event: SseEvent): void => {
        if (closed) return;
        try {
          controller.enqueue(encodeEvent(encoder, event));
        } catch {
          // Controller closed (client disconnected); swallow.
          closed = true;
        }
      };

      const fail = (err: unknown): void => {
        const isAbort =
          err instanceof Error &&
          (err.name === "AbortError" || err.name === "TimeoutError");
        // Distinguish deadline-fire from generic abort so the user sees a
        // concrete budget message instead of "cancelled or timed out".
        const isDeadline = deadlineSignal.aborted && !requestSignal.aborted;
        const message = isDeadline
          ? `Build budget exhausted (~${Math.round(
              BUILD_DEADLINE_MS / 1000,
            )}s) before completing. Try again.`
          : isAbort
            ? "Build was cancelled or timed out before completing. Try again."
            : err instanceof Error
              ? err.message
              : "Unknown build error.";
        if (!isAbort && !isDeadline) {
          console.error(
            `[build] persona build failed for slug=${slug}:`,
            err instanceof Error ? err.stack ?? err.message : err,
          );
        }
        send({ type: "error", message });
      };

      // Heartbeat: SSE has no built-in keep-alive; some intermediaries (CDN,
      // proxies) cut idle streams after ~30-60s. A periodic `ping` event also
      // lets the client distinguish "still working" from "stream went silent
      // because the function got killed". Cheap; client ignores `ping`.
      pingTimer = setInterval(() => {
        send({ type: "ping" });
      }, 15_000);

      // If the request itself aborts (client disconnect), close the stream
      // promptly. Distinct from the deadline path so client-initiated
      // cancels don't surface as "budget exhausted" errors.
      requestSignal.addEventListener("abort", () => {
        closed = true;
        if (pingTimer) clearInterval(pingTimer);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });

      // Deadline-fire path. Emits a clean SSE error so the user sees a
      // concrete budget message before the function exits, rather than an
      // opaque Vercel 504. We don't close the controller here — the
      // `finally` block at the bottom of the try-catch handles cleanup
      // after `buildPersona` rejects via the composite signal.
      deadlineSignal.addEventListener("abort", () => {
        console.error(`[persona] deadline reached`, {
          slug,
          elapsedMs: Date.now() - requestStartMs,
          budget: BUILD_DEADLINE_MS,
        });
        send({
          type: "error",
          message: `Build budget exhausted (~${Math.round(
            BUILD_DEADLINE_MS / 1000,
          )}s) before completing. Try again.`,
        });
      });

      try {
        await withSlugLock(slug, async () => {
          if (await hasPersona(slug)) {
            // Cheap cache hit — surface immediately and skip the pipeline.
            // (Either pre-existing or just produced by a sibling build that
            // we waited on inside withSlugLock.)
            send({ type: "ready", cached: true });
            return;
          }

          const persona = await buildPersona({
            slug,
            name,
            fetch: fetchConfig,
            onProgress: (event) => send(event),
            signal: compositeSignal,
          });

          await setPersona(persona);

          // Re-read meta from the freshly written persona to ensure callers
          // receive the same shape `status` would return.
          const cached = await getPersona(slug);
          const meta: PersonaMeta = cached?.meta ?? persona.meta;

          send({ type: "ready", cached: false, meta });
        });
      } catch (err) {
        // Deadline-fire already emitted its own SSE error via the
        // listener above; avoid stomping it with a generic abort message.
        if (!(deadlineSignal.aborted && !requestSignal.aborted)) {
          fail(err);
        }
      } finally {
        if (pingTimer) clearInterval(pingTimer);
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });

  return new Response(stream, { status: 200, headers: sseHeaders() });
}
