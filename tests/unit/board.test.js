import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBoard,
  applyMove,
  placeStone,
  groupAndLiberties,
  idx,
  IllegalMove,
  BLACK,
  WHITE,
} from '../../src/go/board.js';

test('board vuota: dimensioni e turno iniziale', () => {
  const b = createBoard(9);
  assert.equal(b.size, 9);
  assert.equal(b.stones.length, 81);
  assert.equal(b.toMove, 'B');
});

test('posa legale alterna il turno', () => {
  const b = createBoard(9);
  const { position } = applyMove(b, 2, 2, 'B');
  assert.equal(position.stones[idx(9, 2, 2)], BLACK);
  assert.equal(position.toMove, 'W');
});

test('posa su intersezione occupata è illegale', () => {
  let b = createBoard(9);
  b = applyMove(b, 2, 2, 'B').position;
  assert.throws(() => applyMove(b, 2, 2, 'W'), (e) => e instanceof IllegalMove && e.reason === 'occupied');
});

test('libertà di una pietra singola al centro = 4', () => {
  const b = placeStone(createBoard(9), 4, 4, 'B');
  const { liberties } = groupAndLiberties(b.stones, 9, idx(9, 4, 4));
  assert.equal(liberties.size, 4);
});

test('cattura di una pietra avversaria circondata', () => {
  // Bianco in (0,0) ad angolo: libertà (1,0) e (0,1). Nero le occupa.
  let b = createBoard(9);
  b = placeStone(b, 0, 0, 'W');
  b = placeStone(b, 1, 0, 'B');
  // Nero gioca (0,1): la pietra bianca (0,0) resta senza libertà → catturata.
  const { position, captures } = applyMove({ ...b, toMove: 'B' }, 0, 1, 'B');
  assert.equal(captures.length, 1);
  assert.equal(position.stones[idx(9, 0, 0)], 0);
});

test('mossa suicida è illegale', () => {
  // Bianco circonda (0,0): pietre bianche in (1,0) e (0,1). Nero in (0,0) = suicidio.
  let b = createBoard(9);
  b = placeStone(b, 1, 0, 'W');
  b = placeStone(b, 0, 1, 'W');
  assert.throws(
    () => applyMove({ ...b, toMove: 'B' }, 0, 0, 'B'),
    (e) => e instanceof IllegalMove && e.reason === 'suicide',
  );
});

test('cattura ha precedenza sul suicidio (mossa che cattura è legale)', () => {
  // Nero in angolo (0,0) con 1 libertà (0,1); bianco circonda quasi tutto.
  // Posizione: B(0,0), B(1,0); W(2,0), W(1,1); (0,1) vuoto.
  // Bianco gioca (0,1): toglie l'ultima libertà al gruppo nero → cattura, non suicidio.
  let b = createBoard(9);
  b = placeStone(b, 0, 0, 'B');
  b = placeStone(b, 1, 0, 'B');
  b = placeStone(b, 2, 0, 'W');
  b = placeStone(b, 1, 1, 'W');
  const { position, captures } = applyMove({ ...b, toMove: 'W' }, 0, 1, 'W');
  assert.equal(captures.length, 2); // cattura il gruppo nero di 2 pietre
  assert.equal(position.stones[idx(9, 0, 0)], 0);
  assert.equal(position.stones[idx(9, 1, 0)], 0);
  assert.equal(position.stones[idx(9, 0, 1)], WHITE);
});

test('posa fuori dai limiti è illegale', () => {
  const b = createBoard(9);
  assert.throws(() => applyMove(b, 9, 0, 'B'), (e) => e.reason === 'out_of_bounds');
});
