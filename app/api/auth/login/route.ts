import { cookies } from "next/headers";

import { NextResponse } from "next/server";


import {


  getPlanJwtSecretBytes,


  isPlanGateEnabled,

  PLAN_SESSION_COOKIE,

} from "@/lib/plan-session-edge";


import {
  mintPlanSessionJwt,
  verifyStoredPassword,

} from "@/lib/plan-session-node";


const COOKIE_SEC = 60 * 60 * 24 * 60;

export async function POST(req: Request): Promise<NextResponse> {
  try {
    if (!isPlanGateEnabled()) {


      return NextResponse.json({ error: "El acceso protegido no está activado en el servidor." }, { status: 400 });


    }




    const secretReady = !!getPlanJwtSecretBytes()?.length;



    if (!secretReady) {


      return NextResponse.json(


        {


          error:


            "Falta PLAN_AUTH_SECRET (≥16 caracteres) para firmar la sesión. Agregalo en Variables de entorno junto con PLAN_ACCESS_PASSWORD.",


        },


        { status: 503 },


      );


    }



    const raw = (await req.json()) as unknown;

    const password =




      typeof raw === "object" && raw !== null && "password" in raw &&




        typeof (raw as { password: unknown }).password === "string" ?



        (raw as { password: string }).password




      : "";




    if (!verifyStoredPassword(password)) {


      return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });


    }



    const token = await mintPlanSessionJwt();


    if (!token) {


      return NextResponse.json({ error: "No se pudo emitir sesión." }, { status: 500 });


    }




    const jar = await cookies();


    jar.set(PLAN_SESSION_COOKIE, token, {


      httpOnly: true,



      secure: process.env.NODE_ENV === "production",



      sameSite: "lax",

      path: "/",




      maxAge: COOKIE_SEC,



    });




    return NextResponse.json({ ok: true });


  } catch {


    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });


  }



}
