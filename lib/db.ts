/**
 * Neon Postgres access, two ways:
 *
 *   query()          HTTP: one request per query, no connection setup. Use
 *                    for single reads and writes (page loads, chat search,
 *                    status checks). Measured ~4x faster than a fresh
 *                    WebSocket connection for a one-row lookup.
 *   withTransaction  WebSocket Pool: a real session for multi-statement
 *                    transactions (the speech build's save). Opened per call
 *                    and closed after, as Neon recommends for serverless.
 */

import { neon, Pool, type PoolClient } from "@neondatabase/serverless";

function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set.");
  return url;
}

/** Run one parameterised query over HTTP and return its rows. */
export async function query<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const sql = neon(databaseUrl());
  return (await sql.query(text, params)) as T[];
}

/** Run `fn` with a connected client, closing the pool afterwards. */
export async function withDb<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: databaseUrl() });
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
    await pool.end();
  }
}

/** Run `fn` inside BEGIN / COMMIT, rolling back on any error. */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withDb(async (client) => {
    await client.query("BEGIN");
    try {
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    }
  });
}

/** pgvector text form: "[0.1,0.2,...]". */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}
