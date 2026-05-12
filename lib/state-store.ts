import { promises as fs } from "fs";

import path from "path";

import {

  neon,

  type NeonQueryFunction,

} from "@neondatabase/serverless";

import { migrateAppState } from "./migrate";

import type { AppState } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

const FILE = path.join(DATA_DIR, "state.json");

const NEON_ROW_ID = "main";

/** Driver en modo objeto (no array mode): tipos estable en Next compile. */

type NeonSql = NeonQueryFunction<false, false>;

function neonSql(connectionString: string): NeonSql {
  return neon(connectionString, {
    arrayMode: false,

    fullResults: false,

  }) as NeonSql;
}

function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export type PlannerStorageBackend = "neon" | "filesystem";

export function plannerStorageBackend(): PlannerStorageBackend {
  return hasDatabaseUrl() ? "neon" : "filesystem";
}

export function getDefaultState(): AppState {
  return migrateAppState({
    stalls: [],
    participants: [],
  });
}

async function ensureNeonTable(sql: NeonSql) {
  await sql`

    CREATE TABLE IF NOT EXISTS biblioteca_lp_state (

      id text PRIMARY KEY,

      payload jsonb NOT NULL,

      updated_at timestamptz NOT NULL DEFAULT now()

    )


  `;
}

async function loadStateFromFilesystem(): Promise<AppState | null> {
  try {
    const raw = await fs.readFile(FILE, "utf8");

    const parsed = JSON.parse(raw) as unknown;

    return migrateAppState(parsed);
  } catch {
    return null;
  }
}

async function loadStateFromNeon(sql: NeonSql): Promise<AppState | null> {
  await ensureNeonTable(sql);

  const rowsUnknown = await sql`


    SELECT payload

    FROM biblioteca_lp_state

    WHERE id = ${NEON_ROW_ID}

    LIMIT 1


  `;

  const rows = Array.isArray(rowsUnknown) ? rowsUnknown : [];

  const row = rows[0] as { payload: unknown } | undefined;

  if (!row?.payload) return null;

  const payload =

    typeof row.payload === "string" ?
      JSON.parse(row.payload as string)
    : row.payload;


  return migrateAppState(payload as Partial<AppState>);
}

export async function loadState(): Promise<AppState> {
  if (hasDatabaseUrl()) {
    const sql = neonSql(process.env.DATABASE_URL as string);

    try {
      const fromDb = await loadStateFromNeon(sql);

      if (fromDb) return fromDb;


      /** Primera corrida Neon: si hay `state.json` local, lo copiamos una vez al pool. */


      const fromFile = await loadStateFromFilesystem();

      if (fromFile) {


        await saveStateToNeon(sql, migrateAppState(fromFile));


      }

      return fromFile ?? getDefaultState();
    } catch {

      console.warn("[biblioteca-lp]", "Falló Neon; intentando archivo…");

      return (await loadStateFromFilesystem()) ?? getDefaultState();
    }
  }

  return (await loadStateFromFilesystem()) ?? getDefaultState();
}

async function saveStateToNeon(sql: NeonSql, next: AppState): Promise<void> {
  await ensureNeonTable(sql);

  const iso = JSON.stringify({
    ...next,

    updatedAt: new Date().toISOString(),
  });

  await sql`


    INSERT INTO biblioteca_lp_state (id, payload, updated_at)

    VALUES (${NEON_ROW_ID}, ${iso}::jsonb, NOW())

    ON CONFLICT (id)

    DO UPDATE SET

      payload = EXCLUDED.payload,

      updated_at = EXCLUDED.updated_at


  `;
}

async function saveStateFilesystem(next: AppState): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  await fs.writeFile(
    FILE,

    JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2),

    "utf8",

  );

}

export async function saveState(next: AppState): Promise<void> {
  const migrated = migrateAppState(next);

  if (hasDatabaseUrl()) {
    try {
      await saveStateToNeon(neonSql(process.env.DATABASE_URL as string), migrated);

      return;
    } catch (e) {


      console.warn("[biblioteca-lp]", "Neon guardado falló → backup en archivo:", e);


    }
  }


  await saveStateFilesystem(migrated);


}
