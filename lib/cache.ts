/**
 * Persona cache.
 *
 * One persona = three artefacts, written and read together:
 *   {slug}.md             — markdown system prompt
 *   {slug}.examples.json  — verbatim quote bank
 *   {slug}.meta.json      — build metadata (counts, dates, source)
 *
 * Two backends, selected at call time by `BLOB_READ_WRITE_TOKEN`:
 *   - Vercel Blob   (production)
 *   - Local filesystem at `data/personas/` (dev fallback)
 *
 * The runtime contract is identical across both backends: getters return null
 * when any of the three artefacts is missing, so partial writes never present
 * as a cache hit.
 *
 * Writes are transactional in spirit: md + examples are written first, then
 * meta.json is written last as the "commit marker". A getPersona call that
 * sees md+examples but no meta therefore reports the cache as a miss, and on
 * any pre-meta write failure the partial siblings are deleted (best-effort)
 * to avoid permanent orphaned blobs.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { del, head, put } from "@vercel/blob";
import {
  renderPersonaExamples,
  renderPersonaMd,
  type Persona,
  type PersonaExamplesFile,
  type PersonaMeta,
} from "./persona";

// ─── Public types ─────────────────────────────────────────────────────────────

export type CachedPersona = {
  md: string;
  examples: PersonaExamplesFile;
  meta: PersonaMeta;
};

// ─── Layout ───────────────────────────────────────────────────────────────────

const BLOB_PREFIX = "personas/";
const FS_DIR = path.join(process.cwd(), "data", "personas");

const EXTS = {
  md: "md",
  examples: "examples.json",
  meta: "meta.json",
} as const;

type ArtefactKind = keyof typeof EXTS;

function blobKey(slug: string, kind: ArtefactKind): string {
  return `${BLOB_PREFIX}${slug}.${EXTS[kind]}`;
}

function fsPath(slug: string, kind: ArtefactKind): string {
  return path.join(FS_DIR, `${slug}.${EXTS[kind]}`);
}

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

/** Resolve a stable pathname to a fetchable URL via head(); null if absent. */
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

async function blobHas(pathname: string): Promise<boolean> {
  try {
    await head(pathname);
    return true;
  } catch (err) {
    if (isBlobNotFound(err)) return false;
    throw err;
  }
}

async function blobDeleteIfPresent(pathname: string): Promise<void> {
  try {
    await del(pathname);
  } catch (err) {
    if (isBlobNotFound(err)) return;
    // Cleanup is best-effort; surface as a warning rather than throwing so
    // we don't shadow the original write error.
    console.warn(
      `[cache] blob cleanup failed for ${pathname}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

// ─── Filesystem backend ───────────────────────────────────────────────────────

async function ensureFsDir(): Promise<void> {
  await fs.mkdir(FS_DIR, { recursive: true });
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

async function fsHas(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function fsDeleteIfPresent(p: string): Promise<void> {
  try {
    await fs.unlink(p);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "ENOENT"
    ) {
      return;
    }
    console.warn(
      `[cache] fs cleanup failed for ${p}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getPersona(slug: string): Promise<CachedPersona | null> {
  if (shouldUseBlob()) {
    const [md, examplesJson, metaJson] = await Promise.all([
      blobReadText(blobKey(slug, "md")),
      blobReadText(blobKey(slug, "examples")),
      blobReadText(blobKey(slug, "meta")),
    ]);
    if (md === null || examplesJson === null || metaJson === null) return null;
    return {
      md,
      examples: JSON.parse(examplesJson) as PersonaExamplesFile,
      meta: JSON.parse(metaJson) as PersonaMeta,
    };
  }

  const [md, examplesJson, metaJson] = await Promise.all([
    fsReadText(fsPath(slug, "md")),
    fsReadText(fsPath(slug, "examples")),
    fsReadText(fsPath(slug, "meta")),
  ]);
  if (md === null || examplesJson === null || metaJson === null) return null;
  return {
    md,
    examples: JSON.parse(examplesJson) as PersonaExamplesFile,
    meta: JSON.parse(metaJson) as PersonaMeta,
  };
}

/**
 * Transactional persona write.
 *
 * Order:
 *   1. md + examples in parallel.
 *   2. meta.json (the commit marker) only after step 1 succeeds.
 *
 * If step 1 fails, we delete whichever sibling did succeed before throwing —
 * so a slug never persists in a "partial" state where md+examples exist but
 * meta does not (which would be invisible to readers anyway, but accumulates
 * billable orphan blobs over time).
 */
export async function setPersona(persona: Persona): Promise<void> {
  const slug = persona.meta.slug;
  const md = renderPersonaMd(persona);
  const examples = renderPersonaExamples(persona);
  const examplesJson = JSON.stringify(examples, null, 2);
  const metaJson = JSON.stringify(persona.meta, null, 2);

  if (shouldUseBlob()) {
    // Step 1: bodies first.
    try {
      await Promise.all([
        blobWriteText(
          blobKey(slug, "md"),
          md,
          "text/markdown; charset=utf-8",
        ),
        blobWriteText(
          blobKey(slug, "examples"),
          examplesJson,
          "application/json; charset=utf-8",
        ),
      ]);
    } catch (err) {
      await Promise.all([
        blobDeleteIfPresent(blobKey(slug, "md")),
        blobDeleteIfPresent(blobKey(slug, "examples")),
      ]);
      throw err;
    }

    // Step 2: commit marker. If this fails, roll back the bodies so a
    // subsequent rebuild starts from a clean slate.
    try {
      await blobWriteText(
        blobKey(slug, "meta"),
        metaJson,
        "application/json; charset=utf-8",
      );
    } catch (err) {
      await Promise.all([
        blobDeleteIfPresent(blobKey(slug, "md")),
        blobDeleteIfPresent(blobKey(slug, "examples")),
      ]);
      throw err;
    }
    return;
  }

  // Filesystem backend mirrors the same transactional contract.
  await ensureFsDir();
  try {
    await Promise.all([
      fsWriteText(fsPath(slug, "md"), md),
      fsWriteText(fsPath(slug, "examples"), examplesJson),
    ]);
  } catch (err) {
    await Promise.all([
      fsDeleteIfPresent(fsPath(slug, "md")),
      fsDeleteIfPresent(fsPath(slug, "examples")),
    ]);
    throw err;
  }

  try {
    await fsWriteText(fsPath(slug, "meta"), metaJson);
  } catch (err) {
    await Promise.all([
      fsDeleteIfPresent(fsPath(slug, "md")),
      fsDeleteIfPresent(fsPath(slug, "examples")),
    ]);
    throw err;
  }
}

export async function hasPersona(slug: string): Promise<boolean> {
  // We check all three artefacts (not just meta) because a partial-state
  // recovery may have left siblings behind. The cleanup pass in setPersona
  // is best-effort; cross-check at read time stays cheap.
  if (shouldUseBlob()) {
    const [a, b, c] = await Promise.all([
      blobHas(blobKey(slug, "md")),
      blobHas(blobKey(slug, "examples")),
      blobHas(blobKey(slug, "meta")),
    ]);
    return a && b && c;
  }

  const [a, b, c] = await Promise.all([
    fsHas(fsPath(slug, "md")),
    fsHas(fsPath(slug, "examples")),
    fsHas(fsPath(slug, "meta")),
  ]);
  return a && b && c;
}
