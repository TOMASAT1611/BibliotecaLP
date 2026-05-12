import { promises as fs } from "fs";

import path from "path";

import type { AppState } from "./types";

import { migrateAppState } from "./migrate";

const DATA_DIR = path.join(process.cwd(), "data");

const FILE = path.join(DATA_DIR, "state.json");

export function getDefaultState(): AppState {
  return migrateAppState({
    stalls: [],

    participants: [],

  });


}

export async function loadState(): Promise<AppState> {
  try {
    const raw = await fs.readFile(FILE, "utf8");


    const parsed = JSON.parse(raw);


    return migrateAppState(parsed);

  } catch {

    return getDefaultState();

  }


}

export async function saveState(next: AppState): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });


  await fs.writeFile(
    FILE,


    JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2),


    "utf8",

  );


}
