import { initAnalyticsFromMeta, initVercelAnalytics } from './analytics.js';
import {
  createInitialState,
  step,
  togglePause,
} from './snakeEngine.js?v=20260329-4';

initAnalyticsFromMeta();
initVercelAnalytics();

const settingsKey = 'snake.settings';
const bestKey = 'snake.bestScore';
const playerIdKey = 'snake.playerId';
const usernameKey = 'snake.username';

const defaults = {
  grid: 20,
  speed: 120,
  startLen: 3,
};

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(settingsKey);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    return {
      grid: clamp(Number(parsed.grid ?? defaults.grid), 10, 40),
      speed: clamp(Number(parsed.speed ?? defaults.speed), 60, 260),
      startLen: clamp(Number(parsed.startLen ?? defaults.startLen), 2, 12),
    };
  } catch {
    return { ...defaults };
  }
}

function saveSettings(s) {
  localStorage.setItem(settingsKey, JSON.stringify(s));
}

function getOrCreatePlayerId() {
  let id = (localStorage.getItem(playerIdKey) ?? '').trim();
  if (id) return id;
  try {
    id = crypto.randomUUID();
  } catch {
    id = `p_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }
  localStorage.setItem(playerIdKey, id);
  return id;
}

function getSavedUsername() {
  return (localStorage.getItem(usernameKey) ?? '').trim();
}

function setSavedUsername(name) {
  localStorage.setItem(usernameKey, name);
}

function newSeed() {
  // Deterministic engine; random seed per new game.
  return (Date.now() >>> 0) ^ ((Math.random() * 0xffffffff) >>> 0);
}

function sanitizeName(input) {
  const raw = (input ?? '').toString().trim();
  if (!raw) return '';
  const cleaned = raw.replace(/\s+/g, ' ').slice(0, 20);
  // Keep in sync with server validation.
  if (!/^[a-zA-Z0-9 _\-\.]+$/.test(cleaned)) return '';
  return cleaned;
}

async function postJson(url, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = data && data.error ? data.error : `http_${resp.status}`;
    const err = new Error(msg);
    err.status = resp.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function getJson(url) {
  const resp = await fetch(url);
  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = data && data.error ? data.error : `http_${resp.status}`;
    const err = new Error(msg);
    err.status = resp.status;
    err.data = data;
    throw err;
  }
  return data;
}

const els = {
  board: /** @type {HTMLDivElement} */ (document.getElementById('board')),
  score: /** @type {HTMLSpanElement} */ (document.getElementById('score')),
  bestScore: /** @type {HTMLSpanElement} */ (document.getElementById('bestScore')),
  status: /** @type {HTMLDivElement} */ (document.getElementById('status')),
  btnPause: /** @type {HTMLButtonElement} */ (document.getElementById('btnPause')),
  btnRestart: /** @type {HTMLButtonElement} */ (document.getElementById('btnRestart')),

  gameOver: /** @type {HTMLDivElement} */ (document.getElementById('gameOver')),
  gameOverTitle: /** @type {HTMLDivElement} */ (document.getElementById('gameOverTitle')),
  gameOverScore: /** @type {HTMLDivElement} */ (document.getElementById('gameOverScore')),
  gameOverBest: /** @type {HTMLDivElement} */ (document.getElementById('gameOverBest')),
  gameOverRestart: /** @type {HTMLButtonElement} */ (document.getElementById('gameOverRestart')),
  gameOverMenu: /** @type {HTMLButtonElement} */ (document.getElementById('gameOverMenu')),
  gameOverSave: /** @type {HTMLButtonElement} */ (document.getElementById('gameOverSave')),
  scoreName: /** @type {HTMLInputElement} */ (document.getElementById('scoreName')),
  scoreMsg: /** @type {HTMLDivElement} */ (document.getElementById('scoreMsg')),

  menu: /** @type {HTMLDivElement} */ (document.getElementById('menu')),
  menuSubtitle: /** @type {HTMLDivElement} */ (document.getElementById('menuSubtitle')),

  menuStart: /** @type {HTMLButtonElement} */ (document.getElementById('menuStart')),
  menuLeaderboard: /** @type {HTMLButtonElement} */ (document.getElementById('menuLeaderboard')),
  menuHowto: /** @type {HTMLButtonElement} */ (document.getElementById('menuHowto')),
  menuOptions: /** @type {HTMLButtonElement} */ (document.getElementById('menuOptions')),
  menuQuit: /** @type {HTMLButtonElement} */ (document.getElementById('menuQuit')),

  pauseResume: /** @type {HTMLButtonElement} */ (document.getElementById('pauseResume')),
  pauseRestart: /** @type {HTMLButtonElement} */ (document.getElementById('pauseRestart')),
  pauseLeaderboard: /** @type {HTMLButtonElement} */ (document.getElementById('pauseLeaderboard')),
  pauseHowto: /** @type {HTMLButtonElement} */ (document.getElementById('pauseHowto')),
  pauseOptions: /** @type {HTMLButtonElement} */ (document.getElementById('pauseOptions')),
  pauseQuit: /** @type {HTMLButtonElement} */ (document.getElementById('pauseQuit')),

  lbStatus: /** @type {HTMLDivElement} */ (document.getElementById('lbStatus')),
  lbList: /** @type {HTMLOListElement} */ (document.getElementById('lbList')),
  lbBack: /** @type {HTMLButtonElement} */ (document.getElementById('lbBack')),

  howBack: /** @type {HTMLButtonElement} */ (document.getElementById('howBack')),

  optSpeed: /** @type {HTMLSelectElement} */ (document.getElementById('optSpeed')),
  optGrid: /** @type {HTMLSelectElement} */ (document.getElementById('optGrid')),
  optLen: /** @type {HTMLSelectElement} */ (document.getElementById('optLen')),
  optBack: /** @type {HTMLButtonElement} */ (document.getElementById('optBack')),
  optApply: /** @type {HTMLButtonElement} */ (document.getElementById('optApply')),

  quitBack: /** @type {HTMLButtonElement} */ (document.getElementById('quitBack')),
};

const playerId = getOrCreatePlayerId();

// Fire-and-forget unique player ping.
postJson('/api/players/seen', { playerId }).catch(() => {});

/** @type {{grid:number,speed:number,startLen:number}} */
let settings = loadSettings();

let width = settings.grid;
let height = settings.grid;

/** @type {HTMLDivElement[]} */
let cells = [];

/** @type {ReturnType<typeof createInitialState>} */
let state = createInitialState({
  width,
  height,
  seed: newSeed(),
  initialLength: settings.startLen,
});
state = { ...state, paused: true };

let started = false;
let menuOpen = true;
let menuScreen = 'main';

let runSaved = false;

/** @type {'up'|'down'|'left'|'right'|null} */
let pendingDir = null;

let bestScore = Number.parseInt(localStorage.getItem(bestKey) ?? '0', 10);
if (!Number.isFinite(bestScore)) bestScore = 0;

let tickTimer = /** @type {ReturnType<typeof setInterval>|null} */ (null);

let lbLastFetchAt = 0;

function buildBoard(size) {
  width = size;
  height = size;

  els.board.innerHTML = '';
  cells = [];

  const cellCount = width * height;
  els.board.style.setProperty('--cols', String(width));
  els.board.style.setProperty('--rows', String(height));

  for (let i = 0; i < cellCount; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cells.push(cell);
    els.board.appendChild(cell);
  }
}

function toIndex(p) {
  return p.y * width + p.x;
}

function showMenu(on) {
  menuOpen = on;
  els.menu.hidden = !on;
}

function showGameOver(on) {
  els.gameOver.hidden = !on;
}

function setMenuScreen(name) {
  menuScreen = name;
  for (const el of document.querySelectorAll('.menuScreen')) {
    const screen = /** @type {HTMLElement} */ (el).dataset.screen;
    /** @type {HTMLElement} */ (el).hidden = screen !== name;
  }

  if (name === 'leaderboard') {
    refreshLeaderboard();
  }
}

function backTarget() {
  return started ? 'pause' : 'main';
}

function syncOptionsUI() {
  els.optSpeed.value = String(settings.speed);
  els.optGrid.value = String(settings.grid);
  els.optLen.value = String(settings.startLen);
}

function setTick(ms) {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(tick, ms);
}

function newGame({ pause } = { pause: false }) {
  state = createInitialState({
    width,
    height,
    seed: newSeed(),
    initialLength: settings.startLen,
  });
  state = { ...state, paused: !!pause };
  pendingDir = null;
  runSaved = false;
  els.scoreMsg.textContent = '';
  showGameOver(false);
}

function start() {
  started = true;
  newGame({ pause: false });
  showMenu(false);
  setMenuScreen('pause');
  render();
  els.board.focus();
}

function openMenu(screen) {
  showGameOver(false);
  showMenu(true);
  setMenuScreen(screen);
  if (started) state = { ...state, paused: true };
  render();
}

function closeMenu() {
  showMenu(false);
  setMenuScreen('pause');
  if (started && !state.gameOver) state = { ...state, paused: false };
  render();
  els.board.focus();
}

function pauseToMenu() {
  if (!started) return;
  if (!state.paused) state = togglePause(state);
  openMenu('pause');
}

function applyOptions() {
  const next = {
    speed: clamp(Number(els.optSpeed.value), 60, 260),
    grid: clamp(Number(els.optGrid.value), 10, 40),
    startLen: clamp(Number(els.optLen.value), 2, 12),
  };

  settings = next;
  saveSettings(settings);
  els.menuSubtitle.textContent = `Grid ${settings.grid} x ${settings.grid}, ${settings.speed}ms`;

  buildBoard(settings.grid);
  setTick(settings.speed);

  started = false;
  newGame({ pause: true });
  openMenu('main');
}

function quit() {
  started = false;
  newGame({ pause: true });
  openMenu('quit');
}

async function refreshLeaderboard() {
  const now = Date.now();
  if (now - lbLastFetchAt < 800) return;
  lbLastFetchAt = now;

  els.lbStatus.textContent = 'Loading...';
  els.lbList.innerHTML = '';

  try {
    const data = await getJson('/api/leaderboard?limit=10');
    const items = Array.isArray(data.items) ? data.items : [];

    if (items.length === 0) {
      els.lbStatus.textContent = 'No scores yet.';
      return;
    }

    els.lbStatus.textContent = '';
    for (const it of items) {
      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'lbRow';

      const name = document.createElement('div');
      name.className = 'lbName';
      const n = (it.username ?? 'Anonymous').toString();
      name.textContent = `${it.rank}. ${n}`;

      const score = document.createElement('div');
      score.className = 'lbScore';
      score.textContent = String(it.score ?? 0);

      row.appendChild(name);
      row.appendChild(score);
      li.appendChild(row);
      els.lbList.appendChild(li);
    }
  } catch (err) {
    if (err && (err.status === 404 || err.message === 'http_404')) {
      els.lbStatus.textContent = 'Leaderboard needs the /api backend (deploy to Vercel or run with vercel dev).';
    } else {
      els.lbStatus.textContent = 'Leaderboard unavailable (API not configured).';
    }
  }
}

async function saveScore() {
  if (!started || !state.gameOver || runSaved) return;

  const username = sanitizeName(els.scoreName.value);
  if (!username) {
    els.scoreMsg.textContent = 'Enter a simple name (letters/numbers/spaces, max 20).';
    return;
  }

  els.gameOverSave.disabled = true;
  els.scoreMsg.textContent = 'Saving...';

  try {
    const data = await postJson('/api/scores', {
      playerId,
      username,
      score: state.score,
      grid: settings.grid,
      speed: settings.speed,
      startLen: settings.startLen,
    });

    runSaved = true;
    setSavedUsername(username);
    els.scoreMsg.textContent = data && data.isNewBest ? 'Saved. New best.' : 'Saved.';
    await refreshLeaderboard();
  } catch (err) {
    els.gameOverSave.disabled = false;
    if (err && err.message === 'kv_not_configured') {
      els.scoreMsg.textContent = 'Scores not configured on this deployment.';
    } else if (err && (err.status === 404 || err.message === 'http_404')) {
      els.scoreMsg.textContent = 'Saving needs the /api backend (deploy to Vercel or run with vercel dev).';
    } else {
      els.scoreMsg.textContent = 'Could not save score.';
    }
  }
}

function render() {
  for (const c of cells) c.className = 'cell';

  const foodI = toIndex(state.food);
  if (cells[foodI]) cells[foodI].classList.add('food');

  for (let i = 0; i < state.snake.length; i++) {
    const seg = state.snake[i];
    const segI = toIndex(seg);
    const cell = cells[segI];
    if (!cell) continue;
    cell.classList.add('snake');
    if (i === 0) cell.classList.add('head');
  }

  els.score.textContent = String(state.score);
  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(bestKey, String(bestScore));
  }
  els.bestScore.textContent = String(bestScore);

  const parts = [];
  if (state.gameOver) parts.push(state.won ? 'You win.' : 'Game over.');
  if (!state.gameOver && state.paused && started && !menuOpen) parts.push('Paused.');
  els.status.textContent = parts.join(' ');

  els.btnPause.textContent = state.paused ? 'Resume' : 'Pause';
  if (!started) els.btnPause.textContent = 'Pause';
  if (state.gameOver) els.btnPause.textContent = 'Pause';

  const shouldShowGameOver = started && state.gameOver && !menuOpen;
  showGameOver(shouldShowGameOver);
  if (shouldShowGameOver) {
    els.gameOverTitle.textContent = state.won ? 'You win' : 'Game over';
    els.gameOverScore.textContent = String(state.score);
    els.gameOverBest.textContent = String(bestScore);

    if (!els.scoreName.value) {
      const saved = getSavedUsername();
      if (saved) els.scoreName.value = saved;
    }

    els.gameOverSave.disabled = runSaved;
  }
}

function setDir(dir) {
  pendingDir = dir;
}

function isTypingTarget(target) {
  const t = /** @type {any} */ (target);
  const tag = (t?.tagName ?? '').toString().toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!t?.isContentEditable;
}

function onKeyDown(e) {
  const k = e.key.toLowerCase();

  // Don't trigger game controls while the user is typing (e.g. name input on game over).
  if (isTypingTarget(e.target)) {
    if (k === 'escape') {
      /** @type {any} */ (e.target)?.blur?.();
    }
    return;
  }

  if (menuOpen) {
    if (k === 'escape') {
      if (menuScreen === 'pause') {
        closeMenu();
        return;
      }
      if (menuScreen === 'options' || menuScreen === 'howto' || menuScreen === 'leaderboard') {
        setMenuScreen(backTarget());
        return;
      }
      return;
    }

    if (k === 'enter') {
      if (menuScreen === 'main') start();
      return;
    }

    if (!started && menuScreen === 'main') {
      if (k.startsWith('arrow') || k === 'w' || k === 'a' || k === 's' || k === 'd') {
        start();
      }
    }
  } else {
    if (k === 'escape') {
      openMenu(state.gameOver ? 'main' : started ? 'pause' : 'main');
      return;
    }
  }

  if (k === 'arrowup' || k === 'w') setDir('up');
  else if (k === 'arrowdown' || k === 's') setDir('down');
  else if (k === 'arrowleft' || k === 'a') setDir('left');
  else if (k === 'arrowright' || k === 'd') setDir('right');
  else if (k === ' ') {
    e.preventDefault();
    if (!started || state.gameOver) return;

    if (menuOpen) {
      closeMenu();
      return;
    }

    state = togglePause(state);
    if (state.paused) {
      openMenu('pause');
    } else {
      render();
    }
  } else if (k === 'r') {
    if (!started) {
      start();
      return;
    }
    newGame({ pause: false });
    if (menuOpen) closeMenu();
    else render();
  }
}

window.addEventListener('keydown', onKeyDown);

// Main menu
els.menuStart.addEventListener('click', () => start());
els.menuLeaderboard.addEventListener('click', () => setMenuScreen('leaderboard'));
els.menuHowto.addEventListener('click', () => setMenuScreen('howto'));
els.menuOptions.addEventListener('click', () => {
  syncOptionsUI();
  setMenuScreen('options');
});
els.menuQuit.addEventListener('click', () => quit());

// Pause menu
els.pauseResume.addEventListener('click', () => closeMenu());
els.pauseRestart.addEventListener('click', () => {
  newGame({ pause: false });
  closeMenu();
});
els.pauseLeaderboard.addEventListener('click', () => setMenuScreen('leaderboard'));
els.pauseHowto.addEventListener('click', () => setMenuScreen('howto'));
els.pauseOptions.addEventListener('click', () => {
  syncOptionsUI();
  setMenuScreen('options');
});
els.pauseQuit.addEventListener('click', () => quit());

// Leaderboard
els.lbBack.addEventListener('click', () => setMenuScreen(backTarget()));

// How to play
els.howBack.addEventListener('click', () => setMenuScreen(backTarget()));

// Options
els.optBack.addEventListener('click', () => setMenuScreen(backTarget()));
els.optApply.addEventListener('click', () => applyOptions());

// Quit
els.quitBack.addEventListener('click', () => openMenu('main'));

// Game over popup
els.gameOverRestart.addEventListener('click', () => {
  if (!started) return;
  newGame({ pause: false });
  render();
  els.board.focus();
});
els.gameOverMenu.addEventListener('click', () => openMenu('main'));
els.gameOverSave.addEventListener('click', () => saveScore());
els.scoreName.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') {
    ev.preventDefault();
    saveScore();
  }
});

// Top buttons
els.btnPause.addEventListener('click', () => {
  if (!started || state.gameOver) return;
  if (menuOpen) {
    closeMenu();
    return;
  }
  state = togglePause(state);
  if (state.paused) pauseToMenu();
  else render();
});

els.btnRestart.addEventListener('click', () => {
  if (!started) {
    start();
    return;
  }
  newGame({ pause: false });
  if (menuOpen) closeMenu();
  else render();
});

for (const btn of document.querySelectorAll('[data-dir]')) {
  btn.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    const dir = /** @type {any} */ (btn).dataset.dir;
    if (dir === 'up' || dir === 'down' || dir === 'left' || dir === 'right') {
      if (menuOpen && !started) start();
      setDir(dir);
      els.board.focus();
    }
  });
}

function tick() {
  state = step(state, pendingDir);
  pendingDir = null;
  render();
}

// Init.
buildBoard(settings.grid);
els.menuSubtitle.textContent = `Grid ${settings.grid} x ${settings.grid}, ${settings.speed}ms`;
setTick(settings.speed);
newGame({ pause: true });
showMenu(true);
setMenuScreen('main');
syncOptionsUI();
render();
els.board.focus();
