import assert from 'node:assert/strict';

import {
  createInitialState,
  restart,
  isOpposite,
  placeFood,
  step,
} from '../src/snakeEngine.js';

/** Minimal no-deps test harness (single-process, no spawning). */
const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('isOpposite works', () => {
  assert.equal(isOpposite('up', 'down'), true);
  assert.equal(isOpposite('left', 'right'), true);
  assert.equal(isOpposite('up', 'left'), false);
});

test('step moves the snake and keeps length when not eating', () => {
  const s0 = createInitialState({ width: 10, height: 10, seed: 1, initialLength: 3 });
  const s1 = step(s0, 'right');

  assert.equal(s1.snake.length, 3);
  assert.deepEqual(s1.snake[0], { x: s0.snake[0].x + 1, y: s0.snake[0].y });
  assert.equal(s1.score, 0);
});

test('step grows and increments score when eating', () => {
  const s0 = createInitialState({ width: 10, height: 10, seed: 1, initialLength: 3 });
  const head = s0.snake[0];
  const sEat = { ...s0, food: { x: head.x + 1, y: head.y } };

  const s1 = step(sEat, 'right');
  assert.equal(s1.score, 1);
  assert.equal(s1.snake.length, 4);
  assert.equal(s1.snake.some((p) => p.x === s1.food.x && p.y === s1.food.y), false);
});

test('wall collision ends the game', () => {
  const s0 = createInitialState({ width: 4, height: 4, seed: 1, initialLength: 3 });
  const sEdge = {
    ...s0,
    snake: [
      { x: 3, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
    ],
    dir: 'right',
  };
  const s1 = step(sEdge, 'right');
  assert.equal(s1.gameOver, true);
});

test('self collision ends the game (moving into body)', () => {
  const s = {
    width: 6,
    height: 6,
    snake: [
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ],
    dir: 'down',
    food: { x: 0, y: 0 },
    score: 0,
    gameOver: false,
    paused: false,
    won: false,
    rngSeed: 1,
  };

  const s1 = step(s, 'left');
  assert.equal(s1.gameOver, true);
});

test('placeFood returns null when board is full', () => {
  const width = 2;
  const height = 2;
  const snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ];
  const placed = placeFood(width, height, snake, 1);
  assert.equal(placed.food, null);
});

test('restart resets snake length to the original initialLength', () => {
  const s0 = createInitialState({ width: 10, height: 10, seed: 1, initialLength: 3 });
  const head = s0.snake[0];
  const sEat = { ...s0, food: { x: head.x + 1, y: head.y } };
  const s1 = step(sEat, 'right');
  assert.equal(s1.snake.length, 4);

  const sR = restart(s1, { seed: 1 });
  assert.equal(sR.snake.length, 3);
  assert.equal(sR.initialLength, 3);
});
let passed = 0;
for (const t of tests) {
  try {
    t.fn();
    passed++;
  } catch (err) {
    console.error(`FAIL: ${t.name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

if (process.exitCode !== 1) {
  console.log(`OK: ${passed}/${tests.length} tests passed`);
}


