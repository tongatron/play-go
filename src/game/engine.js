// Orchestrazione di una partita: deriva lo stato (posizione, turno, fine) dall'SGF
// memorizzato e applica nuove mosse usando il motore puro src/go/. Tiene sottili le
// rotte HTTP.

import { createBoard } from '../go/board.js';
import { applyMoveWithKo } from '../go/ko.js';
import { toSGF, fromSGF, replayPositions } from '../go/sgf.js';

/** SGF iniziale (solo header) per una nuova partita. */
export function newSgf(size, komi) {
  return toSGF({ size, komi, moves: [] });
}

/** Estrae le mosse da un SGF. */
export function movesOf(sgf) {
  return fromSGF(sgf).moves;
}

/** Stato derivato: posizione, history (per ko), turno, e doppio-pass. */
export function stateOf({ size, sgf }) {
  const { moves } = fromSGF(sgf);
  const { position, history } = replayPositions({ size, moves });
  const last = moves[moves.length - 1];
  const prev = moves[moves.length - 2];
  const doublePass = last?.kind === 'pass' && prev?.kind === 'pass';
  const turn = position.toMove;
  return { moves, position, history, turn, doublePass };
}

/** Posizione in forma client: matrice [size][size] con 0/1/2. */
export function toClientPosition(position) {
  const { size, stones } = position;
  const grid = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) row.push(stones[y * size + x]);
    grid.push(row);
  }
  return grid;
}

/**
 * Applica una posa e restituisce il nuovo SGF + esito.
 * @throws IllegalMove | KoViolation se la mossa non è legale
 */
export function play({ size, komi, sgf }, color, x, y) {
  const { moves, position, history, turn } = stateOf({ size, sgf });
  if (turn !== color) {
    const e = new Error('not_your_turn');
    e.reason = 'not_your_turn';
    throw e;
  }
  const r = applyMoveWithKo(position, x, y, color, history);
  const newMoves = [...moves, { color, kind: 'play', x, y }];
  return {
    sgf: toSGF({ size, komi, moves: newMoves }),
    captures: r.captures,
    position: r.position,
    nextTurn: r.position.toMove,
  };
}

/** Applica un pass. */
export function pass({ size, komi, sgf }, color) {
  const { moves, turn } = stateOf({ size, sgf });
  if (turn !== color) {
    const e = new Error('not_your_turn');
    e.reason = 'not_your_turn';
    throw e;
  }
  const newMoves = [...moves, { color, kind: 'pass' }];
  const prev = moves[moves.length - 1];
  return {
    sgf: toSGF({ size, komi, moves: newMoves }),
    doublePass: prev?.kind === 'pass',
    nextTurn: color === 'B' ? 'W' : 'B',
  };
}
