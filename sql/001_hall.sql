-- Shared Moopit hall. Unowned rows: no accounts, insert-only.
-- Rank is (game_id, mode). Cipher groups every run a player posts, across games.

create table if not exists hall_runs (
  game_id     text not null,
  run_id      text not null,
  player_id   text not null,
  cipher      text not null,
  handle      text not null,
  mode        text not null,
  difficulty  text not null default '',
  score       integer not null,
  level       integer not null default 1,
  stats       jsonb not null default '{}'::jsonb,
  posted_at   timestamptz not null default now(),
  primary key (game_id, run_id)
);

create index if not exists hall_runs_rank_idx
  on hall_runs (game_id, mode, score desc, posted_at asc);

create index if not exists hall_runs_cipher_idx
  on hall_runs (cipher);

create index if not exists hall_runs_player_idx
  on hall_runs (player_id);
