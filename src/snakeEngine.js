/*
  Classic Snake engine: deterministic, testable, and UI-agnostic.

  State is immutable: `step()` returns a new state object.
*/

export const DIR = /** @type {const} */ ({
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
});

/** @typedef {'up'|'down'|'left'|'right'} Direction */
/** @typedef {{x:number,y:number}} Point */
/**
 * @typedef {object} GameState
 * @property {number} width
 * @property {number} height
* @property {number} initialLength\r\n * @property {Point[]} snake  // head first
 * @property {Direction} dir
 * @property {Point} food
 * @property {number} score
 * @property {boolean} gameOver
 * @property {boolean} paused
 * @property {boolean} won
 * @property {number} rngSeed
 */

function isDir(x) {
  return x === 'up' || x === 'down' || x === 'left' || x === 'right';
}

/** @param {Direction} a @param {Direction} b */
export function isOpposite(a, b) {
  return (
    (a === 'up' && b === 'down') ||
    (a === 'down' && b === 'up') ||
    (a === 'left' && b === 'right') ||
    (a === 'right' && b === 'left')
  );
}

/**
 * Mulberry32 PRNG (fast and deterministic).
 * @param {number} seed
 */
export function nextRandom(seed) {
  // Force to uint32.
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { seed: t >>> 0, value };
}

/** @param {Point} p @param {number} width */
function idx(p, width) {
  return p.y * width + p.x;
}

/** @param {Point} a @param {Point} b */
function eq(a, b) {
  return a.x === b.x && a.y === b.y;
}

/** @param {Point} p @param {number} width @param {number} height */
function inBounds(p, width, height) {
  return p.x >= 0 && p.x < width && p.y >= 0 && p.y < height;
}

/**
 * @param {number} width
 * @param {number} height
 * @param {Point[]} snake
 * @param {number} seed
 */
export function placeFood(width, height, snake, seed) {
  const occupied = new Set(snake.map((p) => idx(p, width)));
  /** @type {Point[]} */
  const empty = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!occupied.has(i)) empty.push({ x, y });
    }
  }

  if (empty.length === 0) return { seed, food: null };

  const r = nextRandom(seed);
  const pick = Math.floor(r.value * empty.length);
  return { seed: r.seed, food: empty[pick] };
}

/**
 * @param {{width?:number,height?:number,seed?:number,initialLength?:number}} [options]
 * @returns {GameState}
 */
export function createInitialState(options = {}) {
  const width = options.width ?? 20;
  const height = options.height ?? 20;
  const initialLength = Math.max(2, Math.min(options.initialLength ?? 3, width));
  let seed = (options.seed ?? 1) >>> 0;

  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);

  /** @type {Point[]} */
  const snake = [];
  for (let i = 0; i < initialLength; i++) {
    snake.push({ x: cx - i, y: cy });
  }

  const placed = placeFood(width, height, snake, seed);
  seed = placed.seed;
  const food = placed.food ?? { x: 0, y: 0 };

  return {
    width,
    height,
    initialLength,
    snake,
    dir: 'right',
    food,
    score: 0,
    gameOver: false,
    paused: false,
    won: false,
    rngSeed: seed,
  };
}

/**
 * Advances the game by 1 tick.
 * @param {GameState} state
 * @param {unknown} inputDir
 * @returns {GameState}
 */
export function step(state, inputDir) {
  if (state.gameOver || state.paused) return state;

  /** @type {Direction} */
  let dir = state.dir;
  if (isDir(inputDir) && !isOpposite(dir, inputDir)) {
    dir = inputDir;
  }

  const d = DIR[dir];
  const head = state.snake[0];
  const nextHead = { x: head.x + d.x, y: head.y + d.y };

  if (!inBounds(nextHead, state.width, state.height)) {
    return { ...state, dir, gameOver: true };
  }

  const eating = eq(nextHead, state.food);

  // Collision: when not eating, the tail cell is vacated, so moving into it is allowed.
  const bodyToCheck = eating ? state.snake : state.snake.slice(0, -1);
  for (const seg of bodyToCheck) {
    if (eq(seg, nextHead)) {
      return { ...state, dir, gameOver: true };
    }
  }

  /** @type {Point[]} */
  const nextSnake = [nextHead, ...state.snake];
  if (!eating) nextSnake.pop();

  if (!eating) {
    return { ...state, dir, snake: nextSnake };
  }

  // Ate food.
  let seed = state.rngSeed;
  const placed = placeFood(state.width, state.height, nextSnake, seed);
  seed = placed.seed;

  if (placed.food == null) {
    return {
      ...state,
      dir,
      snake: nextSnake,
      score: state.score + 1,
      gameOver: true,
      won: true,
      rngSeed: seed,
    };
  }

  return {
    ...state,
    dir,
    snake: nextSnake,
    food: placed.food,
    score: state.score + 1,
    rngSeed: seed,
  };
}

/**
 * Convenience helpers for UI.
 */
export function togglePause(state) {
  if (state.gameOver) return state;
  return { ...state, paused: !state.paused };
}

export function restart(state, options = {}) {
  return createInitialState({
    width: options.width ?? state.width,
    height: options.height ?? state.height,
    seed: options.seed ?? 1,
    initialLength: options.initialLength ?? state.initialLength ?? state.snake.length,
  });
}

