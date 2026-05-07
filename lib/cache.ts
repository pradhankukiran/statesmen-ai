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
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  head,
  list,
  put,
  type ListBlobResult,
  type ListBlobResultBlob,
} from "@vercel/blob";
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

function useBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

// ─── Blob backend ─────────────────────────────────────────────────────────────

/** Resolve a stable pathname to a fetchable URL via head(); null if absent. */
async function blobUrl(pathname: string): Promise<string | null> {
  try {
    const meta = await head(pathname);
    return meta.url;
  } catch (err) {
    // @vercel/blob throws BlobNotFoundError when the object does not exist.
    // We treat any "not found" failure as a cache miss; other errors bubble.
    if (err instanceof Error && /not\s*found/i.test(err.message)) return null;
    if (
      err &&
      typeof err === "object" &&
      "name" in err &&
      typeof (err as { name?: unknown }).name === "string" &&
      /BlobNotFound/i.test((err as { name: string }).name)
    ) {
      return null;
    }
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
    if (err instanceof Error && /not\s*found/i.test(err.message)) return false;
    if (
      err &&
      typeof err === "object" &&
      "name" in err &&
      typeof (err as { name?: unknown }).name === "string" &&
      /BlobNotFound/i.test((err as { name: string }).name)
    ) {
      return false;
    }
    throw err;
  }
}

async function blobListMetaUrls(): Promise<ListBlobResultBlob[]> {
  const out: ListBlobResultBlob[] = [];
  let cursor: string | undefined = undefined;
  for (;;) {
    const page: ListBlobResult = await list({
      prefix: BLOB_PREFIX,
      cursor,
      limit: 1000,
    });
    for (const b of page.blobs) {
      if (b.pathname.endsWith(`.${EXTS.meta}`)) out.push(b);
    }
    if (!page.hasMore || !page.cursor) break;
    cursor = page.cursor;
  }
  return out;
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

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getPersona(slug: string): Promise<CachedPersona | null> {
  if (useBlob()) {
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

export async function setPersona(persona: Persona): Promise<void> {
  const slug = persona.meta.slug;
  const md = renderPersonaMd(persona);
  const examples = renderPersonaExamples(persona);
  const examplesJson = JSON.stringify(examples, null, 2);
  const metaJson = JSON.stringify(persona.meta, null, 2);

  if (useBlob()) {
    await Promise.all([
      blobWriteText(blobKey(slug, "md"), md, "text/markdown; charset=utf-8"),
      blobWriteText(
        blobKey(slug, "examples"),
        examplesJson,
        "application/json; charset=utf-8",
      ),
      blobWriteText(
        blobKey(slug, "meta"),
        metaJson,
        "application/json; charset=utf-8",
      ),
    ]);
    return;
  }

  await ensureFsDir();
  await Promise.all([
    fsWriteText(fsPath(slug, "md"), md),
    fsWriteText(fsPath(slug, "examples"), examplesJson),
    fsWriteText(fsPath(slug, "meta"), metaJson),
  ]);
}

export async function hasPersona(slug: string): Promise<boolean> {
  if (useBlob()) {
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

export async function listPersonas(): Promise<PersonaMeta[]> {
  if (useBlob()) {
    const entries = await blobListMetaUrls();
    const metas = await Promise.all(
      entries.map(async (entry) => {
        const res = await fetch(entry.url, { cache: "no-store" });
        if (!res.ok) return null;
        try {
          return JSON.parse(await res.text()) as PersonaMeta;
        } catch {
          return null;
        }
      }),
    );
    return metas.filter((m): m is PersonaMeta => m !== null);
  }

  let names: string[] = [];
  try {
    names = await fs.readdir(FS_DIR);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "ENOENT"
    ) {
      return [];
    }
    throw err;
  }

  const metaFiles = names.filter((n) => n.endsWith(`.${EXTS.meta}`));
  const metas = await Promise.all(
    metaFiles.map(async (n) => {
      const text = await fsReadText(path.join(FS_DIR, n));
      if (text === null) return null;
      try {
        return JSON.parse(text) as PersonaMeta;
      } catch {
        return null;
      }
    }),
  );
  return metas.filter((m): m is PersonaMeta => m !== null);
}
