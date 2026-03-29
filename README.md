# Snake

This repo contains a minimal classic Snake game (no dependencies).

For a full walkthrough of how the game is put together (engine + UI + tests + deployment), see `BUILDING.md`.
For informal internal notes (stack/architecture/testing/issues), see `DEV_NOTES.md`.

## Run

Option A (recommended): start a local server so ES modules load correctly:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

Option B: you can also double-click `index.html`, but some browsers block module imports from `file://` URLs.

## Controls

- Menu: Esc
- Move: Arrow keys or WASD
- Pause/Resume: Space or the Pause button
- Restart: R or the Restart button
- Mobile: use the on-screen D-pad

## Tests

This environment blocks `node --test` (it fails with `spawn EPERM`), so run the engine tests with:

```powershell
node test/run-tests.mjs
```

If that fails due to path issues, run it with the fully-qualified path in quotes.
