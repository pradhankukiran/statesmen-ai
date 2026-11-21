import { getPerson, type StoredPerson } from "@/lib/speeches";

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusResponse =
  | { status: "ready"; person: StoredPerson }
  | { status: "missing" };

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const slug = searchParams.get("slug");
  if (!slug || slug.trim().length === 0) {
    return Response.json(
      { error: "Query parameter 'slug' is required." },
      { status: 400 },
    );
  }

  try {
    const person = await getPerson(slug);
    const body: StatusResponse =
      person === null ? { status: "missing" } : { status: "ready", person };
    return Response.json(body, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown cache error.";
    return Response.json(
      { error: `Persona status lookup failed: ${message}` },
      { status: 502 },
    );
  }
}
