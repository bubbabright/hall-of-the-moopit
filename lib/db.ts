import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

let sql: Sql | null = null;
let ready = false;

export async function getSql(): Promise<Sql> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Hall database is not configured");
  if (!sql) sql = neon(url);
  if (!ready) {
    await sql`
      create table if not exists hall_runs (
        game_id text not null,
        run_id text not null,
        player_id text not null,
        cipher text not null,
        handle text not null,
        mode text not null,
        difficulty text not null default '',
        score integer not null,
        level integer not null default 1,
        stats jsonb not null default '{}'::jsonb,
        posted_at timestamptz not null default now(),
        primary key (game_id, run_id)
      )
    `;
    await sql`create index if not exists hall_runs_rank_idx on hall_runs (game_id, mode, score desc, posted_at asc)`;
    await sql`create index if not exists hall_runs_cipher_idx on hall_runs (cipher)`;
    await sql`create index if not exists hall_runs_player_idx on hall_runs (player_id)`;
    ready = true;
  }
  return sql;
}
