import { jwtVerify } from "jose";

/** Cookie HttpOnly donde guardamos la sesión del planeador */
export const PLAN_SESSION_COOKIE = "biblioteca_planner_sess";

export const PLAN_JWT_ISSUER = "biblioteca-lp-planner";

export function isPlanGateEnabled(): boolean {
  return Boolean(process.env.PLAN_ACCESS_PASSWORD?.trim());
}

export function getPlanJwtSecretBytes(): Uint8Array | null {
  const raw = process.env.PLAN_AUTH_SECRET?.trim();
  if (!raw || raw.length < 16) return null;

  return new TextEncoder().encode(raw);
}

export async function verifyPlanSessionToken(token: string | undefined): Promise<boolean> {
  const secret = getPlanJwtSecretBytes();
  if (!secret?.length || !token) return false;

  try {
    await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer: PLAN_JWT_ISSUER,
    });

    return true;
  } catch {
    return false;
  }
}
