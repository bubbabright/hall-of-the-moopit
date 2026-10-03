import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isAllowedOrigin } from "./games";

export function corsHeaders(origin: string | null): HeadersInit {
  const allow = isAllowedOrigin(origin) ? origin : "https://hall.moopit.fun";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Moopit-Game",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

export function json(origin: string | null, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(origin) });
}

export function preflight(origin: string | null) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

function parseGameKeys(): Record<string, string> {
  try {
    const raw = process.env.HALL_GAME_KEYS ?? "{}";
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.length >= 8) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Writes need a per-game bearer token. Not anti-cheat; just keeps random POST noise down. */
export function authorizeGame(req: Request, gameId: string): boolean {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  const expected = parseGameKeys()[gameId];
  if (!expected || !token) return false;
  return safeEqual(token, expected);
}

const hits = new Map<string, { n: number; reset: number }>();

export function rateLimit(ip: string, limit = 40, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const row = hits.get(ip);
  if (!row || now > row.reset) {
    hits.set(ip, { n: 1, reset: now + windowMs });
    return true;
  }
  row.n += 1;
  return row.n <= limit;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}
