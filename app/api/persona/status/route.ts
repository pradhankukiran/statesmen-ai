import { getPersona, hasPersona } from "@/lib/cache";
import type { PersonaMeta } from "@/lib/persona";

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusResponse =
  | { status: "ready"; meta: PersonaMeta }
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
    if (!(await hasPersona(slug))) {
      const body: StatusResponse = { status: "missing" };
      return Response.json(body, { status: 200 });
    }

    const cached = await getPersona(slug);
    if (cached === null) {
      // Race: artefacts vanished between the existence check and the read.
      const body: StatusResponse = { status: "missing" };
      return Response.json(body, { status: 200 });
    }

    const body: StatusResponse = { status: "ready", meta: cached.meta };
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
