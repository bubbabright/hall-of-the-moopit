import { cookies } from "next/headers";
import { CIPHER_RE, ID_RE, deriveCipher } from "@/lib/cipher";
import { json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

const COOKIE = "moopit_player";

function cookieDomain(): string | undefined {
  const explicit = process.env.COOKIE_DOMAIN?.trim();
  if (explicit) return explicit;
  return undefined;
}

function newPlayerId(): string {
  return crypto.randomUUID();
}

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

export async function GET(req: Request) {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value ?? "";
  const playerId = ID_RE.test(existing) ? existing : newPlayerId();
  const cipher = deriveCipher(playerId);
  const domain = cookieDomain();

  const res = json(req.headers.get("origin"), { playerId, cipher });
  res.cookies.set(COOKIE, playerId, {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    ...(domain ? { domain } : {}),
  });
  if (!CIPHER_RE.test(cipher)) {
    return json(req.headers.get("origin"), { error: "Could not mint cipher" }, 500);
  }
  return res;
}
