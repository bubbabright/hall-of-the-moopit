import type { GameDef } from "./types";

export const GAMES: GameDef[] = [
  {
    id: "gemfall",
    name: "GEMFALL",
    url: "https://gemfall.moopit.fun",
    origins: ["https://gemfall.moopit.fun"],
    modes: [
      { id: "endless", label: "Endless" },
      { id: "timed", label: "Timed" },
      { id: "moves", label: "Moves" },
    ],
    statOrder: ["gems", "maxCascade", "lines", "bombs", "hypers", "shuffles"],
    statLabels: {
      gems: "gems",
      maxCascade: "cascade",
      lines: "L",
      bombs: "B",
      hypers: "H",
      shuffles: "shuf",
    },
  },
  {
    id: "tetris",
    name: "Moopit Tetris",
    url: "https://tetris.moopit.fun",
    origins: ["https://tetris.moopit.fun"],
    modes: [{ id: "marathon", label: "Marathon" }],
    statOrder: ["lines", "tetrises"],
    statLabels: { lines: "lines", tetrises: "Tetris" },
  },
];

export function gameById(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}

export function extraOrigins(): string[] {
  return (process.env.HALL_EXTRA_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function allowedOrigins(): Set<string> {
  const set = new Set<string>([
    "https://hall.moopit.fun",
    "https://moopit.fun",
    "https://www.moopit.fun",
    ...extraOrigins(),
  ]);
  for (const game of GAMES) {
    for (const origin of game.origins) set.add(origin);
  }
  return set;
}

export function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  if (allowedOrigins().has(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.protocol === "https:" && url.hostname.endsWith(".moopit.fun")) return true;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
  } catch {
    return false;
  }
  return false;
}
