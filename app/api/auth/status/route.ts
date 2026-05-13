import { cookies } from "next/headers";

import { NextResponse } from "next/server";


import {


  isPlanGateEnabled,


  PLAN_SESSION_COOKIE,

  verifyPlanSessionToken,

} from "@/lib/plan-session-edge";

export async function GET(): Promise<NextResponse> {
  const locked = isPlanGateEnabled();


  const authenticated = await verifyPlanSessionToken(


    (await cookies()).get(PLAN_SESSION_COOKIE)?.value,




  );


  return NextResponse.json({ locked, authenticated });


}

