# Hall of the Moopit

Shared anonymous scoreboard for every Moopit game.

Live home (once DNS is pointed): **https://hall.moopit.fun**

No accounts. Each phone gets a cipher (`ABCD-EF01`). Every score posted with that cipher — GEMFALL, Tetris, the next one — sits together. Tap a cipher to see that player across games.

This repo is the hall only. Games stay in their own repos and post here.

## How a game posts

Copy [`clients/moopit-hall.ts`](clients/moopit-hall.ts) into the game.

1. Ask the hall who this phone is (sets a cookie on `.moopit.fun` so every subdomain shares the same player):

```ts
const me = await hallIdentity("https://hall.moopit.fun");
```

2. After a run, post from the game (server-side if you have a server; from the browser is fine for a family board):

```ts
await postToHall("https://hall.moopit.fun", process.env.HALL_GAME_KEY, {
  gameId: "gemfall",          // or "tetris"
  runId: crypto.randomUUID(), // unique per run, never reuse
  playerId: me.playerId,
  cipher: me.cipher,
  handle: "Kay",
  mode: "endless",            // gemfall: endless | timed | moves · tetris: marathon
  difficulty: "normal",
  score: 18400,
  level: 8,
  stats: { gems: 220, maxCascade: 5, lines: 3, bombs: 1, hypers: 0, shuffles: 3 },
});
```

3. Open the player’s board:

```ts
openHall("https://hall.moopit.fun", { game: "gemfall", cipher: me.cipher });
```

Writes need `Authorization: Bearer <game key>`. That key is **not anti-cheat** — a static game like Tetris will ship it in the client. It only keeps random internet POST noise down. Unique `runId`s stop double-posts.

The hall rejects a cipher that does not match `playerId` (same derivation GEMFALL already uses).

## Games registered

| id | title | modes | stats |
|---|---|---|---|
| `gemfall` | GEMFALL | endless, timed, moves | gems, cascade, lines, bombs, hypers, shuffles |
| `tetris` | Moopit Tetris | marathon | lines, tetrises |

Add a new title in [`lib/games.ts`](lib/games.ts), give it a key in `HALL_GAME_KEYS`, ship the client helper.

## Env (Vercel)

| name | purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres |
| `HALL_GAME_KEYS` | JSON `{"gemfall":"…","tetris":"…"}` |
| `COOKIE_DOMAIN` | `.moopit.fun` in production so every game shares the cipher |
| `HALL_EXTRA_ORIGINS` | optional extra CORS origins (current GEMFALL deploy URL, etc.) |

Schema is created automatically on first request. Raw SQL is in [`sql/001_hall.sql`](sql/001_hall.sql).

## Deploy

This app needs a **database**, so it belongs on Vercel + Neon (Tetris can stay on CloudFront).

1. Import this GitHub repo in Vercel.
2. Create a Neon database and paste `DATABASE_URL`.
3. Set `HALL_GAME_KEYS` and `COOKIE_DOMAIN=.moopit.fun`.
4. In Cloudflare, CNAME `hall` → the Vercel host, DNS only.

Then point GEMFALL and Tetris at `https://hall.moopit.fun`. Until they post, this board is empty on purpose — GEMFALL still has its in-game Hall of Gems.

## Local

```
cp .env.example .env.local
# fill DATABASE_URL + HALL_GAME_KEYS
npm install
npm run dev
```
