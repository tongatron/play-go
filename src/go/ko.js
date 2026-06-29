// Ko / superko posizionale. Una mossa è vietata se ricrea una posizione
// (configurazione di pietre + colore al tratto) già occorsa nella partita.
// Coprire il superko posizionale con un solo meccanismo copre anche il ko semplice.

import { applyMove } from './board.js';

/** Hash compatto e deterministico di una posizione (stato pietre + turno). */
export function positionHash(position) {
  // Una cifra per intersezione (0/1/2) + il colore al tratto: sufficiente e veloce
  // per board fino a 19x19. Non crittografico — serve solo per confronto uguaglianza.
  let s = position.toMove + ':';
  const { stones } = position;
  for (let i = 0; i < stones.length; i++) s += stones[i];
  return s;
}

export class KoViolation extends Error {
  constructor() {
    super('ko');
    this.name = 'KoViolation';
    this.reason = 'ko';
  }
}

/**
 * Applica una mossa e verifica il superko posizionale rispetto a `history`.
 * @param {object} position posizione corrente
 * @param {number} x @param {number} y @param {string} color 'B'|'W'
 * @param {Set<string>} history insieme degli hash delle posizioni già viste
 *   (inclusa quella iniziale e tutte le precedenti)
 * @returns {{position:object, captures:number[], hash:string}}
 * @throws {KoViolation} se la posizione risultante ripete una già vista
 * @throws {IllegalMove} per occupied/suicide/out_of_bounds (da applyMove)
 */
export function applyMoveWithKo(position, x, y, color, history) {
  const result = applyMove(position, x, y, color);
  const hash = positionHash(result.position);
  if (history.has(hash)) throw new KoViolation();
  return { ...result, hash };
}
