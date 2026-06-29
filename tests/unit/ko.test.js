import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, placeStone, idx } from '../../src/go/board.js';
import { applyMoveWithKo, positionHash, KoViolation } from '../../src/go/ko.js';

// Forma di ko canonica (origine in alto a sinistra):
//   y\x  0 1 2 3
//   0    . ● ○ .
//   1    ● ○ . ○
//   2    . ● ○ .
// La pietra bianca (1,1) ha una sola libertà in (2,1).
function koPosition() {
  let b = createBoard(9);
  for (const [x, y, c] of [
    [1, 0, 'B'], [2, 0, 'W'],
    [0, 1, 'B'], [1, 1, 'W'], [3, 1, 'W'],
    [1, 2, 'B'], [2, 2, 'W'],
  ]) b = placeStone(b, x, y, c);
  return { ...b, toMove: 'B' };
}

test('superko: posizione ripetuta rilevata via history', () => {
  const b = createBoard(9);
  const after = placeStone(b, 4, 4, 'B');
  after.toMove = 'W';
  const history = new Set([positionHash(b), positionHash(after)]);
  assert.throws(
    () => applyMoveWithKo(b, 4, 4, 'B', history),
    (e) => e instanceof KoViolation && e.reason === 'ko',
  );
});

test('ko: cattura legale, poi la ricattura immediata è vietata', () => {
  const start = koPosition();
  const history = new Set([positionHash(start)]);

  // Nero gioca (2,1): cattura la pietra bianca (1,1).
  const r = applyMoveWithKo(start, 2, 1, 'B', history);
  assert.equal(r.captures.length, 1);
  assert.equal(r.position.stones[idx(9, 1, 1)], 0); // bianco rimosso
  history.add(r.hash);

  // Bianco prova a ricatturare subito in (1,1): ricrea la posizione iniziale → ko.
  assert.throws(
    () => applyMoveWithKo(r.position, 1, 1, 'W', history),
    (e) => e instanceof KoViolation,
  );
});

test('ko: dopo una mossa altrove (minaccia), la ricattura torna legale', () => {
  const start = koPosition();
  const history = new Set([positionHash(start)]);

  const r1 = applyMoveWithKo(start, 2, 1, 'B', history); // Nero cattura
  history.add(r1.hash);

  // Bianco gioca altrove (ko threat) invece di ricatturare.
  const r2 = applyMoveWithKo(r1.position, 6, 6, 'W', history);
  history.add(r2.hash);

  // Nero risponde altrove.
  const r3 = applyMoveWithKo(r2.position, 7, 7, 'B', history);
  history.add(r3.hash);

  // Ora Bianco può ricatturare in (1,1): la posizione non è più identica a una passata.
  const r4 = applyMoveWithKo(r3.position, 1, 1, 'W', history);
  assert.equal(r4.captures.length, 1); // ricattura il Nero in (2,1)
});
