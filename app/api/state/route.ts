import { NextResponse } from "next/server";


import type { AppState } from "@/lib/types";

import { loadState, plannerStorageBackend, saveState } from "@/lib/state-store";


import {


  migrateAppState,


} from "@/lib/migrate";

export const dynamic = "force-dynamic";

export async function GET() {


  const state = await loadState();


  const res = NextResponse.json(JSON.parse(JSON.stringify(state)) as AppState);


  res.headers.set("x-planner-storage", plannerStorageBackend());


  return res;


}


export async function PUT(req: Request) {


  let bodyUnknown: unknown;


  try {


    bodyUnknown = await req.json();


  } catch {


    return NextResponse.json({ error: "El cuerpo no era JSON válido." }, { status: 400 });


  }



  try {


    const merged = migrateAppState(bodyUnknown);


    await saveState(merged);


    const sanitized = JSON.parse(JSON.stringify(merged)) as AppState;


    const res = NextResponse.json(sanitized);


    res.headers.set("x-planner-storage", plannerStorageBackend());


    return res;


  } catch (e) {


    const trace =


      e instanceof Error ?


        `${e.name}: ${e.message}`


      : String(e);



    console.error("[biblioteca-lp/state PUT]", trace);


    return NextResponse.json(


      {


        error:


          "No pudimos aplicar ni guardar el estado. Probá Exportar como respaldo.",


        detail: trace.slice(0, 800),


      },



      /** Si falla Postgres/servidor, 500 tiene más sentido que 400 */


      /postgres|ECONN|EHOST|ENOTFOUND|neon|timed out|certificate/i.test(trace) ?
        { status: 503 }


      : { status: 400 },



    );


  }


}


