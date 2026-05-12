/**
 * Warmup state for the Modal-hosted LLM endpoint.
 *
 * Modal scales the container down ~300s after the last request. To present an
 * accurate "warm / warming / cold" hint in the UI we persist two stamps:
 *
 *   - lastWarmAt        — unix-ms of the most recent successful Modal activity.
 *   - warmingStartedAt  — unix-ms when an explicit /warmup was kicked off and
 *                          has not yet recorded activity.
 *
 * Storage shape on disk/blob:
 *   { "lastWarmAt": <unix-ms or null>, "warmingStartedAt": <unix-ms or null> }
 *
 * Two backends, selected at call time by `BLOB_READ_WRITE_TOKEN` (mirrors
 * `lib/cache.ts`):
 *   - Vercel Blob   (production) at `warmup-state.json` (namespace root).
 *   - Local filesystem at `data/warmup-state.json` (dev fallback).
 *
 * Writes are last-writer-wins; no locking. Reads tolerate a missing file and
 * return all-null. Recorders SWALLOW errors — the build pipeline fires these
 * and must never have its hot path broken by a storage hiccup.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { head, put } from "@vercel/blob";

// ─── Public constants ─────────────────────────────────────────────────────────

export const WARMUP_TTL_SECONDS = 270;
export const WARMING_TTL_SECONDS = 120;

// ─── Public types ─────────────────────────────────────────────────────────────

export type WarmupState = {
  state: "cold" | "warming" | "warm";
  lastWarmAt: number | null;
  ageSeconds: number | null;
  ttlSeconds: number;
};

// ─── Layout ───────────────────────────────────────────────────────────────────

const BLOB_KEY = "warmup-state.json";
const FS_PATH = path.join(process.cwd(), "data", "warmup-state.json");

type StoredState = {
  lastWarmAt: number | null;
  warmingStartedAt: number | null;
};

const EMPTY_STATE: StoredState = {
  lastWarmAt: null,
  warmingStartedAt: null,
};

function shouldUseBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

// ─── Blob backend ─────────────────────────────────────────────────────────────

function isBlobNotFound(err: unknown): boolean {
  if (
    err instanceof Error &&
    /(not\s*found|does\s*not\s*exist)/i.test(err.message)
  ) {
    return true;
  }
  if (
    err &&
    typeof err === "object" &&
    "name" in err &&
    typeof (err as { name?: unknown }).name === "string" &&
    /BlobNotFound/i.test((err as { name: string }).name)
  ) {
    return true;
  }
  return false;
}

async function blobUrl(pathname: string): Promise<string | null> {
  try {
    const meta = await head(pathname);
    return meta.url;
  } catch (err) {
    if (isBlobNotFound(err)) return null;
    throw err;
  }
}

async function blobReadText(pathname: string): Promise<string | null> {
  const url = await blobUrl(pathname);
  if (!url) return null;
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `Blob fetch ${res.status} ${res.statusText} for ${pathname}`,
    );
  }
  return await res.text();
}

async function blobWriteText(
  pathname: string,
  body: string,
  contentType: string,
): Promise<void> {
  await put(pathname, body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  });
}

// ─── Filesystem backend ───────────────────────────────────────────────────────

async function ensureFsDir(): Promise<void> {
  await fs.mkdir(path.dirname(FS_PATH), { recursive: true });
}

async function fsReadText(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf8");
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "ENOENT"
    ) {
      return null;
    }
    throw err;
  }
}

async function fsWriteText(p: string, body: string): Promise<void> {
  await ensureFsDir();
  await fs.writeFile(p, body, "utf8");
}

// ─── Read / write helpers ─────────────────────────────────────────────────────

function parseStoredState(raw: string | null): StoredState {
  if (raw === null) return EMPTY_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredState> | null;
    if (parsed === null || typeof parsed !== "object") return EMPTY_STATE;
    const lastWarmAt =
      typeof parsed.lastWarmAt === "number" && Number.isFinite(parsed.lastWarmAt)
        ? parsed.lastWarmAt
        : null;
    const warmingStartedAt =
      typeof parsed.warmingStartedAt === "number" &&
      Number.isFinite(parsed.warmingStartedAt)
        ? parsed.warmingStartedAt
        : null;
    return { lastWarmAt, warmingStartedAt };
  } catch {
    // Corrupt file (truncated mid-write, manual tampering). Treat as missing
    // so the next recorder overwrites it cleanly.
    return EMPTY_STATE;
  }
}

async function readStoredState(): Promise<StoredState> {
  if (shouldUseBlob()) {
    const text = await blobReadText(BLOB_KEY);
    return parseStoredState(text);
  }
  const text = await fsReadText(FS_PATH);
  return parseStoredState(text);
}

async function writeStoredState(state: StoredState): Promise<void> {
  const body = JSON.stringify(state, null, 2);
  if (shouldUseBlob()) {
    await blobWriteText(BLOB_KEY, body, "application/json; charset=utf-8");
    return;
  }
  await fsWriteText(FS_PATH, body);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getWarmupState(): Promise<WarmupState> {
  const { lastWarmAt, warmingStartedAt } = await readStoredState();
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

  const ageSeconds =
    lastWarmAt !== null ? Math.floor((now - lastWarmAt) / 1000) : null;

  return {
    state,
    lastWarmAt,
    ageSeconds,
    ttlSeconds: WARMUP_TTL_SECONDS,
  };
}

/**
 * Stamp a successful Modal activity. Clears `warmingStartedAt` so an in-flight
 * /warmup that has now succeeded no longer reports as "warming".
 *
 * Fire-and-forget contract: never throws. Storage failures are logged and
 * swallowed so callers on the hot path (build pipeline) aren't impacted.
 */
export async function recordModalActivity(): Promise<void> {
  try {
    // Last-writer-wins overwrite: we don't merge against a prior read because
    // `lastWarmAt` is the only field we set and `warmingStartedAt` is
    // unconditionally cleared on success.
    await writeStoredState({
      lastWarmAt: Date.now(),
      warmingStartedAt: null,
    });
  } catch (err) {
    console.error(
      "[warmup-state] recordModalActivity failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Stamp the start of an explicit warmup attempt. Lets the UI distinguish
 * "warming" from "cold" while the Modal container is spinning up.
 *
 * Fire-and-forget contract: never throws.
 */
export async function recordModalWarmupStarted(): Promise<void> {
  try {
    const current = await readStoredState();
    await writeStoredState({
      lastWarmAt: current.lastWarmAt,
      warmingStartedAt: Date.now(),
    });
  } catch (err) {
    console.error(
      "[warmup-state] recordModalWarmupStarted failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
