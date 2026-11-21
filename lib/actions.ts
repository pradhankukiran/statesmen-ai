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

import { findPerson, type StoredPerson } from "@/lib/speeches";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PersonaStatusResult =
  | { status: "ready"; person: StoredPerson }
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
 *   - cache hit                      → `{ status: "ready", person }`
 *   - upstream cache failure         → `{ status: "error", ... }`
 *
 * Note: errors are returned (not thrown) so the calling `useActionState`
 * reducer can render them as React state without an error boundary.
 */
export async function checkPersonaStatusAction(
  slug: string,
  memberId: number | null = null,
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
    const validId =
      typeof memberId === "number" && Number.isInteger(memberId) && memberId > 0
        ? memberId
        : null;
    // The returned person's slug may differ from `trimmed`; callers must
    // route to `person.slug`.
    const person = await findPerson({ slug: trimmed, memberId: validId });
    if (person === null) return { status: "missing" };
    return { status: "ready", person };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown cache error.";
    return {
      status: "error",
      message: `Persona status lookup failed: ${message}`,
    };
  }
}
