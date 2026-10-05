"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameDef, HallRun, PlayerIdentity } from "@/lib/types";
import { CIPHER_RE } from "@/lib/cipher";

function formatStats(game: GameDef | undefined, row: HallRun): string {
  const bits: string[] = [`Lv ${row.level}`];
  if (row.difficulty) bits.push(row.difficulty);
  const order = game?.statOrder ?? Object.keys(row.stats);
  for (const key of order) {
    const n = row.stats[key];
    if (!n) continue;
    const label = game?.statLabels[key] ?? key;
    bits.push(key === "maxCascade" ? `×${n} ${label}` : `${n} ${label}`);
  }
  return bits.join(" · ");
}

export function Hall({ games }: { games: GameDef[] }) {
  const [identity, setIdentity] = useState<PlayerIdentity | null>(null);
  const [gameId, setGameId] = useState("all");
  const [mode, setMode] = useState("all");
  const [cipher, setCipher] = useState("");
  const [lookup, setLookup] = useState("");
  const [rows, setRows] = useState<HallRun[]>([]);
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState(false);

  const game = games.find((g) => g.id === gameId);

  const refresh = async (nextGame: string, nextMode: string, nextCipher: string) => {
    const params = new URLSearchParams();
    if (nextGame !== "all") params.set("game", nextGame);
    if (nextMode !== "all") params.set("mode", nextMode);
    if (nextCipher) params.set("cipher", nextCipher);
    const qs = params.toString();
    const res = await fetch(`/api/runs${qs ? `?${qs}` : ""}`);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || "Could not load the hall");
    }
    setRows((await res.json()) as HallRun[]);
  };

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const g = search.get("game") ?? "all";
    const m = search.get("mode") ?? "all";
    const c = (search.get("cipher") ?? "").toUpperCase();
    setGameId(g);
    setMode(m);
    setCipher(CIPHER_RE.test(c) ? c : "");
    void fetch("/api/identity", { credentials: "include" })
      .then((r) => r.json())
      .then((id: PlayerIdentity) => setIdentity(id))
      .catch(() => undefined);
    void refresh(g, m, CIPHER_RE.test(c) ? c : "")
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Could not load"))
      .finally(() => setLoaded(true));
  }, []);

  const pushUrl = (nextGame: string, nextMode: string, nextCipher: string) => {
    const params = new URLSearchParams();
    if (nextGame !== "all") params.set("game", nextGame);
    if (nextMode !== "all") params.set("mode", nextMode);
    if (nextCipher) params.set("cipher", nextCipher);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/?${qs}` : "/");
  };

  const apply = (nextGame: string, nextMode: string, nextCipher: string) => {
    setGameId(nextGame);
    setMode(nextMode);
    setCipher(nextCipher);
    pushUrl(nextGame, nextMode, nextCipher);
    setLoaded(false);
    void refresh(nextGame, nextMode, nextCipher)
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Could not load"))
      .finally(() => setLoaded(true));
  };

  const openCipher = (value: string) => {
    const next = value.toUpperCase().trim();
    if (!CIPHER_RE.test(next)) {
      setStatus("Cipher looks like ABCD-EF01.");
      return;
    }
    setStatus("");
    apply(gameId, mode, next);
  };

  const grouped = useMemo(() => {
    const keys = gameId === "all" ? games.map((g) => g.id) : [gameId];
    return keys.map((id) => ({
      game: games.find((g) => g.id === id),
      rows: rows.filter((r) => r.gameId === id && (mode === "all" || r.mode === mode)),
    }));
  }, [rows, gameId, mode, games]);

  const playerMeta = useMemo(() => {
    if (!cipher || rows.length === 0) return null;
    const latest = [...rows].sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1))[0];
    return {
      handle: latest?.handle ?? "Player",
      runs: rows.length,
      mine: latest?.playerId === identity?.playerId,
    };
  }, [cipher, rows, identity]);

  return (
    <main className="hall">
      <header>
        <p className="kicker">Opt-in · anonymous · all Moopit games</p>
        <h1>Hall of the Moopit</h1>
        <p className="lede">
          One cipher is one player. Post from GEMFALL, Tetris, or the next game — every run
          tagged with that cipher sits together here.
        </p>
        {identity ? (
          <p className="cipher">
            Your cipher
            <button type="button" className="cipher-mark" onClick={() => openCipher(identity.cipher)}>
              {identity.cipher}
            </button>
          </p>
        ) : null}
      </header>

      {cipher ? (
        <section className="card">
          <p className="kicker">{playerMeta?.mine ? "Your posted runs" : "Posted runs"}</p>
          <h2 style={{ marginTop: "0.2rem", fontSize: "1.5rem" }}>{playerMeta?.handle ?? "Player"}</h2>
          <p className="cipher">
            Cipher <span>{cipher}</span>
            {playerMeta ? ` · ${playerMeta.runs} run${playerMeta.runs === 1 ? "" : "s"}` : ""}
          </p>
          <button type="button" className="btn" onClick={() => apply(gameId, mode, "")}>
            All scores
          </button>
        </section>
      ) : (
        <section className="card">
          <label className="label" htmlFor="cipher-lookup">
            Find a player
          </label>
          <div className="row">
            <input
              id="cipher-lookup"
              className="input"
              maxLength={9}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="ABCD-EF01"
              value={lookup}
              onChange={(e) => setLookup(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") openCipher(lookup);
              }}
            />
            <button type="button" className="btn" onClick={() => openCipher(lookup)}>
              Find
            </button>
          </div>
        </section>
      )}

      <nav className="tabs" aria-label="Game">
        <button type="button" className={gameId === "all" ? "tab on" : "tab"} onClick={() => apply("all", "all", cipher)}>
          All games
        </button>
        {games.map((g) => (
          <button
            key={g.id}
            type="button"
            className={gameId === g.id ? "tab on" : "tab"}
            onClick={() => apply(g.id, "all", cipher)}
          >
            {g.name}
          </button>
        ))}
      </nav>

      {game ? (
        <nav className="tabs" aria-label="Mode">
          <button type="button" className={mode === "all" ? "tab on" : "tab"} onClick={() => apply(gameId, "all", cipher)}>
            All
          </button>
          {game.modes.map((m) => (
            <button
              key={m.id}
              type="button"
              className={mode === m.id ? "tab on" : "tab"}
              onClick={() => apply(gameId, m.id, cipher)}
            >
              {m.label}
            </button>
          ))}
        </nav>
      ) : null}

      {status ? <p className="status">{status}</p> : null}

      {!loaded ? (
        <p className="empty">Loading the hall…</p>
      ) : grouped.every((g) => g.rows.length === 0) ? (
        <p className="empty">
          {cipher ? "No posts on this cipher yet." : "No posts yet. Finish a run in a Moopit game and tap Post."}
        </p>
      ) : (
        grouped.map((group) =>
          group.rows.length === 0 ? null : (
            <section key={group.game?.id}>
              <h2>{group.game?.name ?? group.game?.id}</h2>
              <ol className="list">
                {group.rows.map((row) => (
                  <li key={`${row.gameId}:${row.runId}`} className={row.playerId === identity?.playerId ? "item mine" : "item"}>
                    <span className="rank">{row.rank}</span>
                    <div className="who">
                      <strong>
                        {row.handle}
                        {row.playerId === identity?.playerId ? " · you" : ""}
                      </strong>
                      <button type="button" onClick={() => openCipher(row.cipher)}>
                        {row.cipher} · {group.game?.modes.find((m) => m.id === row.mode)?.label ?? row.mode}
                      </button>
                    </div>
                    <div className="score">
                      <strong>{row.score.toLocaleString()}</strong>
                      <span>{formatStats(group.game, row)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ),
        )
      )}

      <p className="fine">No accounts. Your cipher stays on this phone (and on every *.moopit.fun game once the hall cookie is set).</p>

      <div className="plays">
        {games.map((g) => (
          <a key={g.id} className="play" href={g.url}>
            Play {g.name}
          </a>
        ))}
      </div>
    </main>
  );
}
