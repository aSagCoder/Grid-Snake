# Troubleshooting / Debug notes

This repo is designed to be **static + dependency-free** (no bundler). The `api/` folder contains Vercel Serverless Functions used for the leaderboard.

## “Save score” / leaderboard missing

Symptoms:
- You don’t see the **Leaderboard** menu button.
- You don’t see the **Save score** button/name field on game over.

Checks:
- On the deployed site, use **View page source** and search for:
  - `menuLeaderboard`
  - `Save score`
- If they are missing, you’re deploying an older commit or a different root directory.

Common cause:
- Changes existed locally but weren’t pushed (especially `api/` being untracked).

## “Could not save score.”

Meaning:
- The browser tried to call `POST /api/scores` but it failed.

Most common local-dev cause:
- You’re running only a static server (e.g. `python -m http.server`), so `/api/*` routes don’t exist (usually 404).

Fix:
- Saving works on Vercel deployments (or locally using `vercel dev`).

## “Scores not configured on this deployment.”

Meaning:
- The Vercel Function is running, but KV/Redis is not configured (server returns `kv_not_configured`).

Fix (Vercel → Project → Settings → Environment Variables, then redeploy):
- Either set Upstash REST env vars:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- Or set Vercel KV env vars:
  - `KV_REST_API_URL`
  - `KV_REST_API_TOKEN`

Also ensure env vars are set for the environment you’re testing:
- Production vs Preview deployments can have different env var sets.

## Game restarts while typing name (R hotkey)

Cause:
- Global keyboard handler listens for `R` and restarts even when the name input is focused.

Fix:
- Ignore game hotkeys when the event target is an `INPUT`/`TEXTAREA`/`SELECT` or `contenteditable`.

## Site becomes “unresponsive” after enabling Vercel Analytics / Speed Insights

Cause:
- A bot PR added `package.json` and switched to **bare module imports** like:
  - `import { inject } from '@vercel/analytics'`
  - `import { injectSpeedInsights } from '@vercel/speed-insights'`
- With no bundler, those imports fail in the browser and the game JS never runs.

Fix (static-friendly):
- Use Vercel’s runtime scripts instead:
  - Analytics: `/_vercel/insights/script.js`
  - Speed Insights: `/_vercel/speed-insights/script.js`

Quick verification:
- Open these URLs on your deployed domain and confirm they return JavaScript (not 404):
  - `https://<your-domain>/_vercel/insights/script.js`
  - `https://<your-domain>/_vercel/speed-insights/script.js`

