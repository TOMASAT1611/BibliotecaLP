import { cookies } from "next/headers";

import { NextResponse } from "next/server";

import { PLAN_SESSION_COOKIE, isPlanGateEnabled } from "@/lib/plan-session-edge";

export async function POST(): Promise<NextResponse> {
  const jar = await cookies();

  if (isPlanGateEnabled()) {


    jar.delete(PLAN_SESSION_COOKIE);


  }




  return NextResponse.json({ ok: true });


}
