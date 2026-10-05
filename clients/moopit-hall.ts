/**
 * Drop this file into a Moopit game.
 *
 * 1. GET identity (credentials: include) so the hall cookie on .moopit.fun
 *    is the same player across every game.
 * 2. POST a run from your game server if you have one; from the browser is
 *    fine for a family board — ship HALL_GAME_KEY as an env the client reads.
 *
 * The hall never accepts a cipher that does not derive from playerId.
 */

export type HallIdentity = { playerId: string; cipher: string };

export type HallRunInput = {
  gameId: string;
  runId: string;
  playerId: string;
  cipher: string;
  handle: string;
  mode: string;
  difficulty?: string;
  score: number;
  level?: number;
  stats?: Record<string, number>;
};

export async function hallIdentity(hallUrl: string): Promise<HallIdentity> {
  const res = await fetch(`${hallUrl.replace(/\/$/, "")}/api/identity`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not reach the hall");
  return (await res.json()) as HallIdentity;
}

export async function postToHall(
  hallUrl: string,
  gameKey: string,
  run: HallRunInput,
): Promise<{ ok: true; duplicate: boolean; rank: number }> {
  const res = await fetch(`${hallUrl.replace(/\/$/, "")}/api/runs`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gameKey}`,
      "X-Moopit-Game": run.gameId,
    },
    body: JSON.stringify(run),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: true;
    duplicate?: boolean;
    rank?: number;
    error?: string;
  };
  if (!res.ok || !body.ok) throw new Error(body.error || "Could not post");
  return { ok: true, duplicate: Boolean(body.duplicate), rank: body.rank ?? 1 };
}

export function openHall(hallUrl: string, opts?: { game?: string; cipher?: string }) {
  const url = new URL(hallUrl);
  if (opts?.game) url.searchParams.set("game", opts.game);
  if (opts?.cipher) url.searchParams.set("cipher", opts.cipher);
  window.location.assign(url.toString());
}
