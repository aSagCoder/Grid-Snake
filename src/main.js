import {
  createInitialState,
  step,
  togglePause,
} from './snakeEngine.js?v=20260323-1';

const settingsKey = 'snake.settings';
const bestKey = 'snake.bestScore';

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

function newSeed() {
  // Deterministic engine; random seed per new game.
  return (Date.now() >>> 0) ^ ((Math.random() * 0xffffffff) >>> 0);
}

const els = {
  board: /** @type {HTMLDivElement} */ (document.getElementById('board')),
  score: /** @type {HTMLSpanElement} */ (document.getElementById('score')),
  bestScore: /** @type {HTMLSpanElement} */ (document.getElementById('bestScore')),
  status: /** @type {HTMLDivElement} */ (document.getElementById('status')),
  btnPause: /** @type {HTMLButtonElement} */ (document.getElementById('btnPause')),
  btnRestart: /** @type {HTMLButtonElement} */ (document.getElementById('btnRestart')),

  menu: /** @type {HTMLDivElement} */ (document.getElementById('menu')),
  menuSubtitle: /** @type {HTMLDivElement} */ (document.getElementById('menuSubtitle')),

  menuStart: /** @type {HTMLButtonElement} */ (document.getElementById('menuStart')),
  menuOptions: /** @type {HTMLButtonElement} */ (document.getElementById('menuOptions')),
  menuQuit: /** @type {HTMLButtonElement} */ (document.getElementById('menuQuit')),

  optSpeed: /** @type {HTMLSelectElement} */ (document.getElementById('optSpeed')),
  optGrid: /** @type {HTMLSelectElement} */ (document.getElementById('optGrid')),
  optLen: /** @type {HTMLSelectElement} */ (document.getElementById('optLen')),
  optBack: /** @type {HTMLButtonElement} */ (document.getElementById('optBack')),
  optApply: /** @type {HTMLButtonElement} */ (document.getElementById('optApply')),

  quitBack: /** @type {HTMLButtonElement} */ (document.getElementById('quitBack')),
};

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

/** @type {'up'|'down'|'left'|'right'|null} */
let pendingDir = null;

let bestScore = Number.parseInt(localStorage.getItem(bestKey) ?? '0', 10);
if (!Number.isFinite(bestScore)) bestScore = 0;

let tickMs = settings.speed;
let tickTimer = /** @type {ReturnType<typeof setInterval>|null} */ (null);

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

function setMenuScreen(name) {
  menuScreen = name;
  for (const el of document.querySelectorAll('.menuScreen')) {
    const screen = /** @type {HTMLElement} */ (el).dataset.screen;
    /** @type {HTMLElement} */ (el).hidden = screen !== name;
  }
}

function syncOptionsUI() {
  els.optSpeed.value = String(settings.speed);
  els.optGrid.value = String(settings.grid);
  els.optLen.value = String(settings.startLen);
}

function setTick(ms) {
  tickMs = ms;
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(tick, tickMs);
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
}

function start() {
  started = true;
  newGame({ pause: false });
  showMenu(false);
  render();
  els.board.focus();
}

function openMenu(screen = 'main') {
  showMenu(true);
  setMenuScreen(screen);
  if (started) state = { ...state, paused: true };
  render();
}

function closeMenu() {
  showMenu(false);
  setMenuScreen('main');
  if (started && !state.gameOver) state = { ...state, paused: false };
  render();
  els.board.focus();
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
}

function setDir(dir) {
  pendingDir = dir;
}

function onKeyDown(e) {
  const k = e.key.toLowerCase();

  if (menuOpen) {
    if (k === 'escape') {
      if (menuScreen !== 'main') {
        setMenuScreen('main');
        return;
      }
      if (started) closeMenu();
      return;
    }

    if (k === 'enter') {
      if (menuScreen === 'main') start();
      return;
    }

    // Let movement keys start the game from the menu.
    if (k.startsWith('arrow') || k === 'w' || k === 'a' || k === 's' || k === 'd') {
      start();
      // fallthrough to apply dir
    }
  } else {
    if (k === 'escape') {
      openMenu('main');
      return;
    }
  }

  if (k === 'arrowup' || k === 'w') setDir('up');
  else if (k === 'arrowdown' || k === 's') setDir('down');
  else if (k === 'arrowleft' || k === 'a') setDir('left');
  else if (k === 'arrowright' || k === 'd') setDir('right');
  else if (k === ' ') {
    e.preventDefault();
    if (!started) return;
    if (menuOpen) {
      closeMenu();
      return;
    }
    state = togglePause(state);
    render();
  } else if (k === 'r') {
    if (!started) {
      start();
      return;
    }
    newGame({ pause: false });
    render();
  }
}

window.addEventListener('keydown', onKeyDown);

els.menuStart.addEventListener('click', () => start());
els.menuOptions.addEventListener('click', () => {
  syncOptionsUI();
  setMenuScreen('options');
});
els.menuQuit.addEventListener('click', () => quit());

els.optBack.addEventListener('click', () => setMenuScreen('main'));
els.optApply.addEventListener('click', () => applyOptions());

els.quitBack.addEventListener('click', () => setMenuScreen('main'));

els.btnPause.addEventListener('click', () => {
  if (!started) return;
  if (menuOpen) {
    closeMenu();
    return;
  }
  state = togglePause(state);
  render();
});

els.btnRestart.addEventListener('click', () => {
  if (!started) {
    start();
    return;
  }
  newGame({ pause: false });
  render();
});

for (const btn of document.querySelectorAll('[data-dir]')) {
  btn.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    const dir = /** @type {any} */ (btn).dataset.dir;
    if (dir === 'up' || dir === 'down' || dir === 'left' || dir === 'right') {
      if (menuOpen) start();
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
