import { NextResponse } from "next/server";

import type { AppState } from "@/lib/types";
import {


  loadState,

  saveState,

} from "@/lib/state-store";


import {


  migrateAppState,

} from "@/lib/migrate";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await loadState();


  return NextResponse.json(state);

}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as Partial<AppState>;


    const merged = migrateAppState(body);


    await saveState(merged);


    return NextResponse.json(merged);

  } catch {

    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  }


}
