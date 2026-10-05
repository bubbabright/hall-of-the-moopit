import { CIPHER_RE, GAME_ID_RE, HANDLE_RE, ID_RE, MODE_RE, deriveCipher, sanitizeHandle } from "@/lib/cipher";
import { getSql } from "@/lib/db";
import { gameById } from "@/lib/games";
import { authorizeGame, clientIp, json, preflight, rateLimit } from "@/lib/http";
import type { HallRun } from "@/lib/types";

export const dynamic = "force-dynamic";

const clamp = (v: unknown, min: number, max: number, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
};

function asRows<T>(value: unknown): T[] {
  return (Array.isArray(value) ? value : []) as T[];
}

function cleanStats(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,23}$/.test(key)) continue;
    out[key] = clamp(value, 0, 9_999_999);
    if (Object.keys(out).length >= 16) break;
  }
  return out;
}

function mapRun(row: Record<string, unknown>, fallbackRank: number): HallRun {
  const statsRaw = row.stats;
  const stats =
    statsRaw && typeof statsRaw === "object" && !Array.isArray(statsRaw)
      ? cleanStats(statsRaw)
      : typeof statsRaw === "string"
        ? cleanStats(JSON.parse(statsRaw) as unknown)
        : {};
  const postedAt =
    row.posted_at instanceof Date ? row.posted_at.toISOString() : String(row.posted_at ?? "");
  return {
    gameId: String(row.game_id ?? ""),
    runId: String(row.run_id ?? ""),
    playerId: String(row.player_id ?? ""),
    cipher: String(row.cipher ?? ""),
    handle: String(row.handle ?? ""),
    mode: String(row.mode ?? ""),
    difficulty: String(row.difficulty ?? ""),
    score: clamp(row.score, 0, 9_999_999),
    level: clamp(row.level, 1, 99, 1),
    stats,
    postedAt,
    rank: clamp(row.hall_rank ?? row.rank, 1, 99_999, fallbackRank),
  };
}

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

export async function GET(req: Request) {
  const origin = req.headers.get("origin");
  try {
    const url = new URL(req.url);
    const game = url.searchParams.get("game") ?? "all";
    const mode = url.searchParams.get("mode") ?? "all";
    const cipherRaw = (url.searchParams.get("cipher") ?? "").toUpperCase().trim();
    const cipher = CIPHER_RE.test(cipherRaw) ? cipherRaw : "";
    if (game !== "all" && !GAME_ID_RE.test(game)) return json(origin, { error: "Unknown game" }, 400);
    if (mode !== "all" && !MODE_RE.test(mode)) return json(origin, { error: "Unknown mode" }, 400);

    const sql = await getSql();
    const limit = cipher ? 200 : 80;
    const rows = asRows<Record<string, unknown>>(
      await sql`
        select * from (
          select game_id, run_id, player_id, cipher, handle, mode, difficulty, score, level,
                 stats, posted_at,
                 rank() over (partition by game_id, mode order by score desc, posted_at asc, run_id) as hall_rank
          from hall_runs
        ) ranked
        where (${game} = 'all' or game_id = ${game})
          and (${mode} = 'all' or mode = ${mode})
          and (${cipher} = '' or cipher = ${cipher})
        order by score desc, posted_at asc
        limit ${limit}
      `,
    );
    return json(origin, rows.map((row, i) => mapRun(row, i + 1)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the hall";
    return json(origin, { error: message }, 500);
  }
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (!rateLimit(clientIp(req))) return json(origin, { error: "Slow down a second" }, 429);
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const gameId = String(body.gameId ?? "");
    const runId = String(body.runId ?? "");
    const playerId = String(body.playerId ?? "");
    const cipher = String(body.cipher ?? "").toUpperCase();
    const handle = sanitizeHandle(body.handle);
    const mode = String(body.mode ?? "").toLowerCase();
    const difficulty = String(body.difficulty ?? "").toLowerCase().slice(0, 16);
    const score = clamp(body.score, 1, 9_999_999);
    const level = clamp(body.level, 1, 99, 1);
    const stats = cleanStats(body.stats);

    if (!GAME_ID_RE.test(gameId) || !gameById(gameId)) return json(origin, { error: "Unknown game" }, 400);
    if (!authorizeGame(req, gameId)) return json(origin, { error: "Game is not authorized to post" }, 401);
    if (!ID_RE.test(runId) || !ID_RE.test(playerId)) return json(origin, { error: "Invalid run" }, 400);
    if (!HANDLE_RE.test(handle)) return json(origin, { error: "Pick a short handle — letters and numbers" }, 400);
    if (!MODE_RE.test(mode)) return json(origin, { error: "Unknown mode" }, 400);
    if (!CIPHER_RE.test(cipher) || deriveCipher(playerId) !== cipher) {
      return json(origin, { error: "Invalid cipher" }, 400);
    }
    if (score < 1) return json(origin, { error: "Score is too low to post" }, 400);

    const game = gameById(gameId)!;
    if (game.modes.length && !game.modes.some((m) => m.id === mode)) {
      return json(origin, { error: "Unknown mode for this game" }, 400);
    }

    const sql = await getSql();
    const existing = asRows<{ run_id: string }>(
      await sql`
        select run_id from hall_runs where game_id = ${gameId} and run_id = ${runId} limit 1
      `,
    );
    if (existing.length === 0) {
      await sql`
        insert into hall_runs (
          game_id, run_id, player_id, cipher, handle, mode, difficulty, score, level, stats
        ) values (
          ${gameId}, ${runId}, ${playerId}, ${cipher}, ${handle}, ${mode}, ${difficulty},
          ${score}, ${level}, ${JSON.stringify(stats)}::jsonb
        )
      `;
    }

    await sql`update hall_runs set handle = ${handle} where player_id = ${playerId}`;

    const ranked = asRows<{ n: number }>(
      await sql`
        select count(*)::int as n from hall_runs
        where game_id = ${gameId} and mode = ${mode}
          and (score > ${score} or (score = ${score} and run_id <= ${runId}))
      `,
    );
    return json(origin, {
      ok: true,
      duplicate: existing.length > 0,
      rank: ranked[0]?.n ?? 1,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not post";
    return json(origin, { error: message }, 400);
  }
}
