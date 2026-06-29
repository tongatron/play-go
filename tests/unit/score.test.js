import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, placeStone } from '../../src/go/board.js';
import { score } from '../../src/go/score.js';

test('board vuota: tutto dame, komi decide', () => {
  const r = score(createBoard(9), { komi: 7.5 });
  assert.equal(r.black, 0);
  assert.equal(r.white, 7.5);
  assert.equal(r.result, 'W+7.5');
});

test('area scoring: pietre + territorio circondato', () => {
  // Nero costruisce un muro che separa la board; contiamo area.
  let b = createBoard(9);
  // Colonna nera in x=4 (tutta la colonna): divide la board in due metà 4 e 4 colonne.
  for (let y = 0; y < 9; y++) b = placeStone(b, 4, y, 'B');
  // Bianco occupa una colonna a x=6.
  for (let y = 0; y < 9; y++) b = placeStone(b, 6, y, 'W');
  const r = score(b, { komi: 0 });
  // Nero: 9 pietre + territorio a sinistra (x=0..3 = 36) = 45
  // Bianco: 9 pietre + territorio a destra (x=7,8 = 18) ; x=5 è dame (tra B e W)
  assert.equal(r.territory.black, 36);
  assert.equal(r.black, 45);
  assert.equal(r.territory.white, 18);
  assert.equal(r.white, 27);
  assert.equal(r.territory.dame, 9); // colonna x=5
  assert.equal(r.result, 'B+18');
});

test('pietre morte rimosse contano come territorio avversario', () => {
  let b = createBoard(9);
  for (let y = 0; y < 9; y++) b = placeStone(b, 4, y, 'B');
  for (let y = 0; y < 9; y++) b = placeStone(b, 6, y, 'W');
  // Una pietra bianca "morta" dentro il territorio nero, in (1,1).
  b = placeStone(b, 1, 1, 'W');
  const dead = [1 * 9 + 1]; // indice di (1,1)
  const r = score(b, { komi: 0, dead });
  // Rimuovendo la pietra morta, l'area nera resta 45 (la casella torna territorio nero).
  assert.equal(r.black, 45);
});

test('komi non intero produce risultato frazionario', () => {
  let b = createBoard(9);
  for (let y = 0; y < 9; y++) b = placeStone(b, 4, y, 'B');
  for (let y = 0; y < 9; y++) b = placeStone(b, 6, y, 'W');
  const r = score(b, { komi: 7.5 });
  // Nero 45, Bianco 27+7.5=34.5 → B+10.5
  assert.equal(r.result, 'B+10.5');
});
