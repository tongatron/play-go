import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSGF, fromSGF, coordToSgf, sgfToCoord, replayPositions } from '../../src/go/sgf.js';
import { idx, BLACK, WHITE } from '../../src/go/board.js';

test('coordinate SGF round-trip', () => {
  assert.equal(coordToSgf(0, 0), 'aa');
  assert.equal(coordToSgf(3, 2), 'dc');
  assert.deepEqual(sgfToCoord('dc'), { x: 3, y: 2 });
});

test('export SGF contiene header e mosse', () => {
  const sgf = toSGF({
    size: 9,
    komi: 7.5,
    moves: [
      { color: 'B', kind: 'play', x: 2, y: 2 },
      { color: 'W', kind: 'play', x: 6, y: 6 },
      { color: 'B', kind: 'pass' },
    ],
  });
  assert.match(sgf, /SZ\[9\]/);
  assert.match(sgf, /KM\[7\.5\]/);
  assert.match(sgf, /;B\[cc\]/);
  assert.match(sgf, /;W\[gg\]/);
  assert.match(sgf, /;B\[\]/); // pass
});

test('round-trip export → import preserva size, komi e mosse', () => {
  const game = {
    size: 13,
    komi: 6.5,
    moves: [
      { color: 'B', kind: 'play', x: 3, y: 3 },
      { color: 'W', kind: 'play', x: 9, y: 9 },
      { color: 'B', kind: 'pass' },
      { color: 'W', kind: 'pass' },
    ],
  };
  const parsed = fromSGF(toSGF(game));
  assert.equal(parsed.size, 13);
  assert.equal(parsed.komi, 6.5);
  assert.deepEqual(parsed.moves, game.moves);
});

test('replay ricostruisce la posizione finale con catture', () => {
  // Bianco in angolo viene catturato dal Nero.
  const moves = [
    { color: 'B', kind: 'play', x: 1, y: 0 },
    { color: 'W', kind: 'play', x: 0, y: 0 },
    { color: 'B', kind: 'play', x: 0, y: 1 }, // cattura W(0,0)
  ];
  const { position } = replayPositions({ size: 9, moves });
  assert.equal(position.stones[idx(9, 0, 0)], 0); // catturata
  assert.equal(position.stones[idx(9, 1, 0)], BLACK);
  assert.equal(position.stones[idx(9, 0, 1)], BLACK);
});

test('replay produce uno snapshot per mossa (più la board vuota)', () => {
  const moves = [
    { color: 'B', kind: 'play', x: 2, y: 2 },
    { color: 'W', kind: 'play', x: 6, y: 6 },
  ];
  const { positions } = replayPositions({ size: 9, moves });
  assert.equal(positions.length, 3); // vuota + 2 mosse
});
