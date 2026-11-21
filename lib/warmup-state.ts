/**
 * Warm/cold state of the Modal embedding service, for the header status dot.
 *
 * Modal scales the container down ~300s after the last request. To show an
 * accurate "warm / warming / cold" hint we keep two timestamps in Neon
 * (`service_state`, row name 'embed'):
 *
 *   - last_warm_at        — most recent successful call to the service.
 *   - warming_started_at  — when an explicit warmup was kicked off and has not
 *                           yet recorded activity.
 *
 * Writes are last-writer-wins. Recorders SWALLOW errors: chat and build call
 * them and must never fail because of a status-dot write.
 */

import { withDb } from "./db";

// ─── Public constants ─────────────────────────────────────────────────────────

/** Just under Modal's 300s scaledown window. */
export const WARMUP_TTL_SECONDS = 270;
/** A cold start takes ~15s; give up on "warming" well after that. */
export const WARMING_TTL_SECONDS = 120;

// ─── Public types ─────────────────────────────────────────────────────────────

export type WarmupState = {
  state: "cold" | "warming" | "warm";
  lastWarmAt: number | null;
  ageSeconds: number | null;
  ttlSeconds: number;
};

const SERVICE = "embed";

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getWarmupState(): Promise<WarmupState> {
  const row = await withDb(async (db) => {
    const { rows } = await db.query(
      `SELECT (extract(epoch FROM last_warm_at) * 1000)::bigint AS last_warm_at,
              (extract(epoch FROM warming_started_at) * 1000)::bigint AS warming_started_at
         FROM service_state WHERE name = $1`,
      [SERVICE],
    );
    return rows[0] as
      | { last_warm_at: string | null; warming_started_at: string | null }
      | undefined;
  });

  const lastWarmAt = row?.last_warm_at != null ? Number(row.last_warm_at) : null;
  const warmingStartedAt =
    row?.warming_started_at != null ? Number(row.warming_started_at) : null;
  const now = Date.now();

  let state: WarmupState["state"] = "cold";
  if (
    warmingStartedAt !== null &&
    now - warmingStartedAt < WARMING_TTL_SECONDS * 1000
  ) {
    state = "warming";
  } else if (
    lastWarmAt !== null &&
    now - lastWarmAt < WARMUP_TTL_SECONDS * 1000
  ) {
    state = "warm";
  }

  return {
    state,
    lastWarmAt,
    ageSeconds: lastWarmAt !== null ? Math.floor((now - lastWarmAt) / 1000) : null,
    ttlSeconds: WARMUP_TTL_SECONDS,
  };
}

/** Stamp a successful call to the embedding service. Never throws. */
export async function recordEmbedActivity(): Promise<void> {
  try {
    await withDb((db) =>
      db.query(
        `INSERT INTO service_state (name, last_warm_at, warming_started_at)
         VALUES ($1, now(), NULL)
         ON CONFLICT (name) DO UPDATE
           SET last_warm_at = now(), warming_started_at = NULL`,
        [SERVICE],
      ),
    );
  } catch (err) {
    console.error(
      "[warmup-state] recordEmbedActivity failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/** Stamp the start of an explicit warmup. Never throws. */
export async function recordWarmupStarted(): Promise<void> {
  try {
    await withDb((db) =>
      db.query(
        `INSERT INTO service_state (name, warming_started_at)
         VALUES ($1, now())
         ON CONFLICT (name) DO UPDATE SET warming_started_at = now()`,
        [SERVICE],
      ),
    );
  } catch (err) {
    console.error(
      "[warmup-state] recordWarmupStarted failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
