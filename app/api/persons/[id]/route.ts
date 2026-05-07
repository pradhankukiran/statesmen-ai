import { getMember, type Member } from "@/lib/members";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePositiveInt(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function isUpstreamNotFound(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /\b404\b/.test(err.message);
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: rawId } = await context.params;

  const id = parsePositiveInt(rawId);
  if (id === null) {
    return Response.json(
      { error: "Path parameter 'id' must be a positive integer." },
      { status: 400 },
    );
  }

  try {
    const member: Member = await getMember(id);
    return Response.json(member, { status: 200 });
  } catch (err) {
    if (isUpstreamNotFound(err)) {
      return Response.json(
        { error: `Member ${id} not found.` },
        { status: 404 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Unknown upstream error.";
    return Response.json(
      { error: `Members API getMember failed: ${message}` },
      { status: 502 },
    );
  }
}
