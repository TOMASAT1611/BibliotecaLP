import { SignJWT } from "jose/jwt/sign";
import { timingSafeEqual } from "node:crypto";

import {
  getPlanJwtSecretBytes,
  PLAN_JWT_ISSUER,
} from "./plan-session-edge";

/** Contraseña compartida (familia / equipo). Guardala en variables de entorno. */
export function verifyStoredPassword(candidate: string): boolean {
  const expected = process.env.PLAN_ACCESS_PASSWORD ?? "";
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(expected, "utf8");

  if (!b.length || a.length !== b.length) return false;

  try {
    return timingSafeEqual(a, b);

  } catch {
    return false;
  }

}

/** Valor compacto para Set-Cookie (JWT firmado HS256). */
export async function mintPlanSessionJwt(): Promise<string | null> {
  const secret = getPlanJwtSecretBytes();
  if (!secret?.length) return null;

  return new SignJWT({ sub: "planner-access" })

    .setProtectedHeader({ alg: "HS256" })

    .setIssuer(PLAN_JWT_ISSUER)

    .setIssuedAt()

    .setExpirationTime("60d")


    .sign(secret);
}
