/**
 * Speech index: fetch a person's Hansard speeches, embed them, store them in
 * Neon, and search them by meaning.
 *
 *   buildSpeechIndex
 *     collectContributions  (lib/collect.ts — career-wide sampling)
 *       → embedDocuments    (lib/embed.ts — Modal embedding service)
 *         → saveSpeeches    (one transaction: replace the person's rows)
 */

import type { Contribution } from "./hansard";
import { collectContributions, type FetchConfig } from "./collect";
import { EMBED_MODEL, embedDocuments, embedQuery } from "./embed";
import { toVectorLiteral, withDb, withTransaction } from "./db";
import { getCareerDates } from "./members";

/** Same floor as the old persona build: below this a persona isn't faithful. */
const MIN_SPEECHES = 20;
/** Rows per INSERT statement (8 params each). */
const INSERT_BATCH = 50;

export type SpeechBuildEvent =
  | { type: "fetch_start" }
  | { type: "fetch_done"; count: number }
  | { type: "embed_progress"; done: number; total: number }
  | { type: "save_start" }
  | { type: "save_done"; count: number };

export type SpeechBuildResult = {
  speechCount: number;
  timingsMs: { fetch: number; embed: number; save: number; total: number };
};

/**
 * Text sent to the embedding model. The debate title gives short answers
 * ("Yes, and we will go further") the topic they were actually about.
 */
function embeddingText(c: Contribution): string {
  return c.debateSection ? `${c.debateSection}\n\n${c.text}` : c.text;
}

/**
 * When the person's time in Parliament ended, as YYYY-MM-DD, or null if they
 * are still serving. Historical (attribution) personas end at their tenure's
 * end date. A Members API failure leaves it null rather than failing the build.
 */
async function resolveEndedAt(fetch: FetchConfig): Promise<string | null> {
  if (fetch.kind === "attribution") return fetch.endDate.slice(0, 10);
  try {
    const { memberships } = await getCareerDates(fetch.memberId);
    if (memberships.length === 0 || memberships.some((m) => m.endDate === null)) {
      return null;
    }
    return memberships.map((m) => m.endDate as string).sort().at(-1) ?? null;
  } catch (err) {
    console.warn(
      `[speeches] career lookup failed for memberId=${fetch.memberId}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function buildSpeechIndex(opts: {
  slug: string;
  name: string;
  fetch: FetchConfig;
  signal?: AbortSignal;
  onProgress?: (event: SpeechBuildEvent) => void;
}): Promise<SpeechBuildResult> {
  const emit = opts.onProgress ?? (() => {});
  const t0 = Date.now();

  emit({ type: "fetch_start" });
  const endedAtPromise = resolveEndedAt(opts.fetch);
  const speeches = await collectContributions(opts.fetch);
  emit({ type: "fetch_done", count: speeches.length });
  const t1 = Date.now();

  if (speeches.length < MIN_SPEECHES) {
    throw new Error(
      `Not enough public speeches found for ${opts.name} ` +
        `(${speeches.length}, minimum ${MIN_SPEECHES}).`,
    );
  }

  const embeddings = await embedDocuments(speeches.map(embeddingText), {
    signal: opts.signal,
    onBatchDone: (done, total) => emit({ type: "embed_progress", done, total }),
  });
  const t2 = Date.now();

  emit({ type: "save_start" });
  await saveSpeeches({ ...opts, endedAt: await endedAtPromise }, speeches, embeddings);
  emit({ type: "save_done", count: speeches.length });
  const t3 = Date.now();

  return {
    speechCount: speeches.length,
    timingsMs: { fetch: t1 - t0, embed: t2 - t1, save: t3 - t2, total: t3 - t0 },
  };
}

/** Replace a person's stored speeches in one transaction. */
async function saveSpeeches(
  person: { slug: string; name: string; fetch: FetchConfig; endedAt: string | null },
  speeches: Contribution[],
  embeddings: number[][],
): Promise<void> {
  await withTransaction(async (db) => {
    await db.query(
      `INSERT INTO persons
         (slug, name, member_id, source, speech_count, embed_model, ended_at, built_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         member_id = EXCLUDED.member_id,
         source = EXCLUDED.source,
         speech_count = EXCLUDED.speech_count,
         embed_model = EXCLUDED.embed_model,
         ended_at = EXCLUDED.ended_at,
         built_at = EXCLUDED.built_at`,
      [
        person.slug,
        person.name,
        person.fetch.kind === "memberId" ? person.fetch.memberId : null,
        JSON.stringify(person.fetch),
        speeches.length,
        EMBED_MODEL,
        person.endedAt,
      ],
    );
    await db.query("DELETE FROM speeches WHERE person_slug = $1", [person.slug]);

    for (let i = 0; i < speeches.length; i += INSERT_BATCH) {
      const rows = speeches.slice(i, i + INSERT_BATCH);
      const params: unknown[] = [];
      const values = rows.map((c, j) => {
        params.push(
          person.slug,
          c.id,
          c.date.slice(0, 10),
          c.house,
          c.debateSection,
          c.debateSectionExtId,
          c.text,
          toVectorLiteral(embeddings[i + j]),
        );
        const b = j * 8;
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}::vector)`;
      });
      await db.query(
        `INSERT INTO speeches
           (person_slug, id, sitting_date, house, debate_title, debate_section_ext_id, text, embedding)
         VALUES ${values.join(", ")}
         ON CONFLICT (person_slug, id) DO NOTHING`,
        params,
      );
    }
  });
}

export type StoredPerson = {
  slug: string;
  name: string;
  memberId: number | null;
  /** YYYY-MM-DD, or null while still serving. */
  endedAt: string | null;
  speechCount: number;
  builtAt: string;
};

const PERSON_COLUMNS = `slug, name, member_id, ended_at::text AS ended_at,
  speech_count, built_at::text AS built_at`;

function toStoredPerson(r: Record<string, unknown>): StoredPerson {
  return {
    slug: r.slug as string,
    name: r.name as string,
    memberId: r.member_id as number | null,
    endedAt: r.ended_at as string | null,
    speechCount: r.speech_count as number,
    builtAt: r.built_at as string,
  };
}

/** A built person by slug (the /chat URL segment), or null. */
export async function getPerson(slug: string): Promise<StoredPerson | null> {
  return withDb(async (db) => {
    const { rows } = await db.query(
      `SELECT ${PERSON_COLUMNS} FROM persons WHERE slug = $1`,
      [slug],
    );
    return rows[0] ? toStoredPerson(rows[0]) : null;
  });
}

/**
 * A built person by Parliament member ID when known, else by slug. The member
 * ID is the real identity: the same person reaches us under different slugs
 * (featured list "tony-blair" vs Members API name "Mr Tony Blair").
 */
export async function findPerson(key: {
  slug: string;
  memberId?: number | null;
}): Promise<StoredPerson | null> {
  return withDb(async (db) => {
    const { rows } =
      key.memberId != null
        ? await db.query(
            `SELECT ${PERSON_COLUMNS} FROM persons
              WHERE member_id = $1 OR slug = $2
              ORDER BY (member_id = $1) DESC
              LIMIT 1`,
            [key.memberId, key.slug],
          )
        : await db.query(
            `SELECT ${PERSON_COLUMNS} FROM persons WHERE slug = $1`,
            [key.slug],
          );
    return rows[0] ? toStoredPerson(rows[0]) : null;
  });
}

export type SpeechMatch = {
  id: string;
  sittingDate: string;
  house: string;
  debateTitle: string | null;
  debateSectionExtId: string | null;
  text: string;
  /** Cosine similarity, -1..1 (higher is closer). */
  similarity: number;
};

/** The `limit` speeches by this person closest in meaning to `question`. */
export async function searchSpeeches(
  slug: string,
  question: string,
  limit = 5,
  opts: { signal?: AbortSignal } = {},
): Promise<SpeechMatch[]> {
  const q = toVectorLiteral(await embedQuery(question, opts));
  return withDb(async (db) => {
    const { rows } = await db.query(
      `SELECT id, sitting_date::text AS sitting_date, house, debate_title,
              debate_section_ext_id, text, 1 - (embedding <=> $2::vector) AS similarity
         FROM speeches
        WHERE person_slug = $1
        ORDER BY embedding <=> $2::vector
        LIMIT $3`,
      [slug, q, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      sittingDate: r.sitting_date,
      house: r.house,
      debateTitle: r.debate_title,
      debateSectionExtId: r.debate_section_ext_id,
      text: r.text,
      similarity: Number(r.similarity),
    }));
  });
}
