export interface HallRun {
  gameId: string;
  runId: string;
  playerId: string;
  cipher: string;
  handle: string;
  mode: string;
  difficulty: string;
  score: number;
  level: number;
  stats: Record<string, number>;
  postedAt: string;
  rank: number;
}

export interface PlayerIdentity {
  playerId: string;
  cipher: string;
}

export interface GameMode {
  id: string;
  label: string;
}

export interface GameDef {
  id: string;
  name: string;
  url: string;
  origins: string[];
  modes: GameMode[];
  statOrder: string[];
  statLabels: Record<string, string>;
}
