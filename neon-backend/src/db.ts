// Datenbankzugriff fuer HangoutHub (Neon Postgres, Datenbank "hangouthub").
import pg from "pg";
import { attachDatabasePool } from "@neon/functions";

// Rohwerte statt JS-Date, damit Zeiten exakt wie bei Jackson/LocalDateTime rausgehen.
pg.types.setTypeParser(20, (v) => Number(v)); // int8 / bigserial
pg.types.setTypeParser(1114, (v) => v.replace(" ", "T")); // timestamp -> 2026-12-31T20:00:00
pg.types.setTypeParser(1082, (v) => v); // date -> 2026-12-31

/**
 * Neon injiziert DATABASE_URL fuer die Standard-Datenbank (neondb). HangoutHub liegt in der
 * Datenbank "hangouthub" im selben Projekt, daher wird nur der Pfad getauscht.
 * HANGOUTHUB_DATABASE_URL ueberschreibt das (z.B. lokal).
 */
export function databaseUrl(): string {
  if (process.env.HANGOUTHUB_DATABASE_URL) return process.env.HANGOUTHUB_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL fehlt");
  const url = new URL(base);
  url.pathname = "/hangouthub";
  return url.toString();
}

export const pool = new pg.Pool({ connectionString: databaseUrl(), max: 5 });
attachDatabasePool(pool);

export type Db = Pick<pg.PoolClient, "query">;

export async function query<T = any>(sql: string, params: unknown[] = [], db: Db = pool): Promise<T[]> {
  const res = await db.query(sql, params as any[]);
  return res.rows as T[];
}

export async function one<T = any>(sql: string, params: unknown[] = [], db: Db = pool): Promise<T | null> {
  const rows = await query<T>(sql, params, db);
  return rows[0] ?? null;
}

/** Fuehrt fn in einer Transaktion aus (entspricht @Transactional). */
export async function tx<T>(fn: (db: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * "Jetzt" als Berliner Ortszeit. Events werden als lokale Wanduhrzeit gespeichert
 * (datetime-local aus dem Frontend), wie beim alten Quarkus-Backend.
 */
export const NOW = "(now() AT TIME ZONE 'Europe/Berlin')";
