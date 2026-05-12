import { NextResponse } from "next/server";

import type { AppState } from "@/lib/types";
import { loadState, plannerStorageBackend, saveState } from "@/lib/state-store";


import {


  migrateAppState,

} from "@/lib/migrate";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await loadState();

  const res = NextResponse.json(state);


  res.headers.set("x-planner-storage", plannerStorageBackend());


  return res;

}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as Partial<AppState>;


    const merged = migrateAppState(body);


    await saveState(merged);

    const res = NextResponse.json(merged);


    res.headers.set("x-planner-storage", plannerStorageBackend());


    return res;

  } catch {

    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  }


}
