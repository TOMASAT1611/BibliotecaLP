import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

import {
  isPlanGateEnabled,
  PLAN_SESSION_COOKIE,
  verifyPlanSessionToken,
} from "@/lib/plan-session-edge";

function isPublicRoute(pathname: string): boolean {
  if (pathname === "/login") return true;

  if (
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/status") ||
    pathname.startsWith("/api/auth/logout")
  )
    return true;

  return false;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (!isPlanGateEnabled()) return NextResponse.next();

  const pathname = request.nextUrl.pathname;

  const token = request.cookies.get(PLAN_SESSION_COOKIE)?.value;

  const okSession = await verifyPlanSessionToken(token);

  if (isPublicRoute(pathname)) {
    if (pathname === "/login" && okSession)
      return NextResponse.redirect(new URL("/", request.url));

    return NextResponse.next();
  }

  if (okSession) return NextResponse.next();

  const url = request.nextUrl.clone();

  url.pathname = "/login";
  url.searchParams.set("next", pathname.startsWith("/") ? pathname : `/${pathname}`);

  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],

};
