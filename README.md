# 🦐 Krillit

A leaderboard for a group of colleagues who play [Krillion](https://krillion.io). Everyone pastes the
text from Krillion's Share button, and Krillit keeps the daily leaderboard and long-term stats.

## Run it

Krillit runs on Vercel with a Neon Postgres database (added through Vercel's Neon integration).

```bash
npm install
vercel link                      # once, to the krillit project
vercel env pull .env.local       # fetches DATABASE_URL, DEMO_DATABASE_URL and the rest
npm run dev                      # against the REAL database: anything you add here is live
npm run demo                     # wipes and refills the separate demo database, then serves it
npm test                         # parser, calendar and percentile tests
```

Use `npm run demo` to try changes; it never touches the real data. `npm run build` creates any missing tables before building (`npm run db:migrate` does just that step).

Environment variables (set them in the Vercel project, then `vercel env pull`):

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | Set by the Neon integration |
| `DEMO_DATABASE_URL` | A second Neon database, Development only, used by `npm run demo` |
| `CRON_SECRET` | Random string; Vercel sends it to `/api/sync` so only the schedule can call it |
| `ADMIN_PASSWORD` | Turns on `/admin`. `ADMIN_SESSION_SECRET` is an optional separate signing key |

Needs Node 22.13+.

## What it does

- **Today** (`/`): paste a result, see the day's leaderboard, everyone against Krillion's worldwide
  average and percentile, a histogram of all Krillion players with our scores on it, and the 7 prompts
  with each person's tier per prompt and the "One in a Krillion" answers (folded away as spoilers).
- **Past days** (`/day/118`): the same view for any dive number.
- **Stats** (`/stats`): average score and average diff against Krillion for this week, this month and
  all time; records (best, daily wins, % beaten, 🌟 count, streak, best weekday); scores over time;
  average by weekday; and how deep each player dives, by answer tier.

## Where the Krillion data comes from

Krillion has no official API. Krillit calls the same public endpoints Krillion's own web client uses
(`src/lib/krillion-sync.ts`):

| Endpoint | Gives us |
|---|---|
| `GET /api/today` | today's dive number and 7 prompts |
| `GET /api/reveal?date=<today>` | the accepted answers and their tiers (we keep only the 🌟 ones) |
| `POST /api/today/complete` with `record: false` | the worldwide score histogram (20 buckets over 0–700) and player count |

**Krillion only exposes the current day.** Krillit saves a snapshot when someone opens the site (at
most every 10 minutes), and two Vercel Schedules in `vercel.json` call `/api/sync`: every 20 minutes,
and at 23:55 New York time to catch the day's near-final average before Krillion resets.

These endpoints are undocumented and could change or disappear without notice. If they do, scores still
work, and only the prompts and worldwide comparisons stop updating.

## Rules baked in

- Only the **Daily Dive** counts. Archive (`⟲`) and Unlimited (`∞`) results are rejected.
- One score per person per dive. Pasting again replaces it.
- Anyone can look; only signed-in players can add scores. There are no passwords: when you join, you
  get an 8-character **sync code** (e.g. `3YQB-G8MA`). The site remembers it on that device in an
  httpOnly cookie. On another device, pick your name and enter the code. Your code is under your
  name in the header.
- **Admin** (`/admin`, behind `ADMIN_PASSWORD`): look up a sync code for someone who lost theirs, rename
  players and delete a wrong score.
- Days roll over at midnight New York time, the same as Krillion.

## Deploying

Live at https://krillit.vercel.app. Pushing to `main` deploys to production through Vercel's Git
integration; other branches get preview URLs. Data access lives only in `src/lib/db.ts`.
