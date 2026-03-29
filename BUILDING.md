# Building this project (end-to-end)

This repo is intentionally **dependency-free**: it’s a static site (HTML/CSS/JS) plus optional Node-based tests. There is no bundler, build step, or package manager required.

## What “build” means here

- **Development build**: edit files in `index.html` and `src/`, then reload the browser.
- **Production build**: the same files. “Shipping” is just copying the folder to any static host.

The one thing you *do* need is a local web server in dev so browsers will load ES modules (`<script type="module">`) correctly.

## Prerequisites

- Any modern browser (Chromium/Firefox/Safari)
- One of:
  - Python 3 (recommended) for `python -m http.server`
  - Any other static server (VS Code Live Server, `npx serve`, etc.)
- Optional: Node.js (only needed to run tests)

## Project structure

- `index.html`: app shell + HUD + menu overlay + on-screen D-pad
- `src/styles.css`: layout and visuals (CSS grid board, menu overlay, mobile controls)
- `src/snakeEngine.js`: deterministic, UI-agnostic game engine (pure functions)
- `src/main.js`: UI glue (DOM board, render loop, input, menu, persistence)
- `test/`: engine tests and a minimal test runner

## Run locally (dev)

From the repo root:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

Why a server: most browsers block module imports from `file://` URLs, so double-clicking `index.html` may fail.

## How the game is built (step-by-step)

### 1) HTML: app shell + accessible controls

`index.html` lays out:

- A top bar with Score + Best.
- A panel containing:
  - HUD status text + Pause/Restart buttons.
  - The board container (`#board`) that will be populated by JS.
  - A menu overlay (`#menu`) that acts like an in-game dialog (Start/Options/Quit).
- A touch D-pad (`[data-dir]` buttons) that’s only shown on coarse pointers (via CSS).

The game board is a simple empty `<div id="board">` with `tabindex="0"` so it can keep keyboard focus.

### 2) CSS: the board is a CSS Grid

`src/styles.css` uses CSS Grid for the board:

- `.board` defines `grid-template-columns/rows` using CSS variables `--cols` and `--rows`.
- Each cell is a `<div class="cell">`; the JS render adds/removes classes:
  - `.snake`, `.head`, `.food`
- The menu is an absolute-positioned overlay with a translucent background + blur.

The board size is responsive (`width: min(74vmin, 560px)`), so it scales on different screens.

### 3) Engine: deterministic state transitions

`src/snakeEngine.js` is designed to be:

- **Deterministic**: it uses a seeded PRNG (`nextRandom`, Mulberry32) so tests can reproduce behavior.
- **UI-agnostic**: it doesn’t touch DOM, timers, or storage.
- **Immutable**: `step(state, inputDir)` returns a new state (or the same one if paused/game-over).

Core pieces:

- `createInitialState({ width, height, seed, initialLength })`
  - Centers the snake, places food via `placeFood`, initializes `rngSeed`.
- `placeFood(width, height, snake, seed)`
  - Builds a list of empty cells and picks one using the PRNG.
  - Returns `{ food: null }` when the board is full (win condition).
- `step(state, inputDir)`
  - Optionally updates direction (rejects opposite direction turns).
  - Moves head, checks wall/self collision.
  - Handles eating:
    - grows snake
    - increments score
    - places new food (or ends game with `won: true` when board is full)
- `togglePause(state)` for UI convenience.

### 4) UI glue: DOM board + render loop + input

`src/main.js` connects the engine to the page:

- **Board construction**: `buildBoard(gridSize)` creates `gridSize * gridSize` cell divs and sets `--cols/--rows`.
- **Rendering**: `render()` clears every cell back to `.cell`, then marks:
  - food cell
  - every snake segment
  - head segment
  - score + best score
  - status text and Pause button label
- **Tick loop**: `setInterval(tick, tickMs)` calls `step(state, pendingDir)` every tick.
  - Input is buffered in `pendingDir` so multiple key presses between ticks resolve to the latest intent.
- **Menu/pause behavior**:
  - Menu open pauses gameplay.
  - `Esc` toggles menu (and backs out of sub-screens).
  - `Enter` starts from the main menu.
- **Persistence**:
  - Settings (`grid`, `speed`, `startLen`) stored in `localStorage` under `snake.settings`.
  - Best score stored under `snake.bestScore`.
- **Cache busting**:
  - `index.html` imports CSS/JS with a `?v=...` query string so browsers refresh assets when you change versions.

### 5) Tests: verify the engine without a framework

The engine is unit-tested under `test/`.

- `test/run-tests.mjs`: minimal no-deps runner (single-process, no spawning)
- `test/snakeEngine.test.mjs`: a `node:test` version (kept for compatibility, but may fail in some restricted environments)

Run the minimal runner:

```powershell
node test/run-tests.mjs
```

## “Production build” / deployment

Because the output is just static files, you can deploy by uploading the repo contents to any static host:

- GitHub Pages
- Netlify / Vercel static sites
- Cloudflare Pages
- Any traditional web server (Nginx/Apache)

Key requirement: serve files over HTTP(S) so module imports work.

## Troubleshooting

- **Blank page or console error about modules**: don’t open via `file://`; run a local server.
- **Keyboard not working**: click the board once; it is focus-driven (`#board` has `tabindex="0"`).
- **D-pad not visible on desktop**: it only appears on coarse pointers (`@media (pointer: coarse)`).

