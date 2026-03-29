# Snake

This repo contains a minimal classic Snake game (no dependencies).

For a full walkthrough of how the game is put together (engine + UI + tests + deployment), see `BUILDING.md`.
For informal internal notes (stack/architecture/testing/issues), see `DEV_NOTES.md`.
For local dev/daily/error logging conventions, see `LOGGING.md`.

## Run (Local)

Start a local server so ES modules load correctly:

```powershell
cd "<path-to-your-repo>"`r`npython -m http.server 8000
```

Then open `http://localhost:8000`.

## Controls

- Menu: Esc
- Move: Arrow keys or WASD
- Pause/Menu: Space or the Pause button
- Restart: R or the Restart button
- Mobile: use the on-screen D-pad

## Tests

This environment blocks `node --test` (it fails with `spawn EPERM`), so run the engine tests with:

```powershell
node test/run-tests.mjs
```

## Deploy (Vercel + Scores API)

This project is a static site plus Vercel Serverless Functions under `api/`.

1. Push the repo to GitHub.
2. Import into Vercel.
3. Add a Redis/KV store:
   - Recommended: use Vercel KV (Upstash Redis) integration.
   - The API code supports either env var set:
     - `KV_REST_API_URL` + `KV_REST_API_TOKEN`
     - or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
4. Deploy.

Endpoints:
- `POST /api/scores` save a score (playerId, username, score, settings)
- `GET /api/leaderboard?limit=10` fetch top scores
- `POST /api/players/seen` records a unique playerId (approx unique players)
- `GET /api/stats` simple counts

## Analytics (GA4)

If you want a unique-visitors dashboard via Google Analytics 4:

1. Create a GA4 property and get a Measurement ID (looks like `G-XXXXXXXXXX`).
2. Put it into the meta tag in `index.html`:

```html
<meta name="ga-measurement-id" content="G-XXXXXXXXXX" />
```

If you leave it blank, analytics will not load.

