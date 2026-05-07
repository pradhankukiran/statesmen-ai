import { searchMembers, type House, type Member } from "@/lib/members";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNonNegativeInt(
  raw: string | null,
  fallback: number,
): number | null {
  if (raw === null || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parseHouse(raw: string | null): House | undefined | null {
  if (raw === null || raw === "") return undefined;
  if (raw === "Commons" || raw === "Lords") return raw;
  return null;
}

function parseBoolFlag(raw: string | null, fallback: boolean): boolean | null {
  if (raw === null || raw === "") return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

function isUpstreamNotFound(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /\b404\b/.test(err.message);
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  request: Request,
): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q");
  if (!q || q.trim().length === 0) {
    return Response.json(
      { error: "Query parameter 'q' is required." },
      { status: 400 },
    );
  }

  const take = parseNonNegativeInt(searchParams.get("take"), 20);
  if (take === null) {
    return Response.json(
      { error: "'take' must be a non-negative integer." },
      { status: 400 },
    );
  }

  const skip = parseNonNegativeInt(searchParams.get("skip"), 0);
  if (skip === null) {
    return Response.json(
      { error: "'skip' must be a non-negative integer." },
      { status: 400 },
    );
  }

  const house = parseHouse(searchParams.get("house"));
  if (house === null) {
    return Response.json(
      { error: "'house' must be 'Commons' or 'Lords'." },
      { status: 400 },
    );
  }

  const includeFormer = parseBoolFlag(
    searchParams.get("includeFormer"),
    false,
  );
  if (includeFormer === null) {
    return Response.json(
      { error: "'includeFormer' must be 'true' or 'false'." },
      { status: 400 },
    );
  }

  try {
    const result: { total: number; members: Member[] } = await searchMembers({
      name: q,
      house,
      take,
      skip,
      includeFormer,
    });
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (isUpstreamNotFound(err)) {
      return Response.json(
        { error: "No results from upstream Members API." },
        { status: 404 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Unknown upstream error.";
    return Response.json(
      { error: `Members API search failed: ${message}` },
      { status: 502 },
    );
  }
}
