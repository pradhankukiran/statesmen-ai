import { getPersona, hasPersona, setPersona } from "@/lib/cache";
import {
  buildPersona,
  type BuildEvent,
  type FetchConfig,
  type PersonaMeta,
} from "@/lib/persona";

export const runtime = "nodejs";
// Free-tier OpenRouter models can take 60–120s per LLM call; with 5-model
// fallback × extract + merge stages, the cold-build pipeline can legitimately
// run 5+ minutes. Vercel Hobby (Fluid Compute) max is 800s; pick a generous
// cap that won't truncate a real build.
export const maxDuration = 300;

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

const DEFAULT_MAX = 80;

// ─── SSE event union ──────────────────────────────────────────────────────────

type SseEvent =
  | BuildEvent
  | { type: "ready"; cached: true }
  | { type: "ready"; cached: false; meta: PersonaMeta }
  | { type: "error"; message: string };

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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: SseEvent): void => {
        try {
          controller.enqueue(encodeEvent(encoder, event));
        } catch {
          // Controller closed (client disconnected); swallow.
        }
      };

      const fail = (err: unknown): void => {
        const message =
          err instanceof Error ? err.message : "Unknown build error.";
        send({ type: "error", message });
      };

      try {
        if (await hasPersona(slug)) {
          // Cheap cache hit — surface immediately and skip the pipeline.
          send({ type: "ready", cached: true });
          return;
        }

        const persona = await buildPersona({
          slug,
          name,
          fetch: fetchConfig,
          onProgress: (event) => send(event),
        });

        await setPersona(persona);

        // Re-read meta from the freshly written persona to ensure callers
        // receive the same shape `status` would return.
        const cached = await getPersona(slug);
        const meta: PersonaMeta = cached?.meta ?? persona.meta;

        send({ type: "ready", cached: false, meta });
      } catch (err) {
        fail(err);
      } finally {
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
