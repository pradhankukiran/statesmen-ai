"use server";

/**
 * Top-level Server Actions module.
 *
 * Server Actions are the App Router's RPC primitive: a callable from the
 * client that runs on the server with no manually-wired API route. They
 * piggyback on React's transition machinery so the calling component can
 * track pending/error state via `useActionState` instead of hand-rolling
 * `useTransition` + `useState`.
 *
 * The corresponding HTTP route at `app/api/persona/status/route.ts` is kept
 * alive intentionally — it's the JSON contract for any external poller. The
 * action below is purely the in-app idiomatic path.
 */

import { getPersona, hasPersona } from "@/lib/cache";
import type { PersonaMeta } from "@/lib/persona";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PersonaStatusResult =
  | { status: "ready"; meta: PersonaMeta }
  | { status: "missing" }
  | { status: "error"; message: string };

// Slug validation mirrors `app/api/persona/status/route.ts` exactly so the
// action and the API route reject the same inputs.
const MAX_SLUG_LENGTH = 200;

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Look up the cache state for a persona slug.
 *
 * Mirrors the HTTP route's behaviour:
 *   - missing/blank/over-length slug → `{ status: "error", ... }`
 *   - cache miss                     → `{ status: "missing" }`
 *   - cache hit                      → `{ status: "ready", meta }`
 *   - upstream cache failure         → `{ status: "error", ... }`
 *
 * Note: errors are returned (not thrown) so the calling `useActionState`
 * reducer can render them as React state without an error boundary.
 */
export async function checkPersonaStatusAction(
  slug: string,
): Promise<PersonaStatusResult> {
  if (typeof slug !== "string") {
    return {
      status: "error",
      message: "Slug must be a string.",
    };
  }
  const trimmed = slug.trim();
  if (trimmed.length === 0) {
    return { status: "error", message: "Slug is required." };
  }
  if (trimmed.length > MAX_SLUG_LENGTH) {
    return {
      status: "error",
      message: `Slug exceeds ${MAX_SLUG_LENGTH} characters.`,
    };
  }

  try {
    if (!(await hasPersona(trimmed))) {
      return { status: "missing" };
    }
    const cached = await getPersona(trimmed);
    if (cached === null) {
      // Race: artefacts vanished between the existence check and the read.
      return { status: "missing" };
    }
    return { status: "ready", meta: cached.meta };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown cache error.";
    return {
      status: "error",
      message: `Persona status lookup failed: ${message}`,
    };
  }
}
