// Conteggio ad AREA (regole cinesi): area di un colore = sue pietre sulla board
// + intersezioni vuote circondate esclusivamente da quel colore. Le pietre marcate
// morte vengono rimosse prima del conteggio (accordo dei giocatori — vedi spec).

import { EMPTY, BLACK, WHITE } from './board.js';

function neighbors(size, i) {
  const x = i % size;
  const y = (i - x) / size;
  const out = [];
  if (x > 0) out.push(i - 1);
  if (x < size - 1) out.push(i + 1);
  if (y > 0) out.push(i - size);
  if (y < size - 1) out.push(i + size);
  return out;
}

/**
 * @param {object} position
 * @param {object} opts
 * @param {number} [opts.komi=7.5] komi a favore del Bianco
 * @param {number[]} [opts.dead=[]] indici di pietre da considerare morte (rimosse)
 * @returns {{black:number, white:number, territory:{black:number,white:number,dame:number}, result:string}}
 */
export function score(position, { komi = 7.5, dead = [] } = {}) {
  const { size } = position;
  const stones = position.stones.slice();
  for (const i of dead) stones[i] = EMPTY; // pietre morte tornano territorio avversario

  let blackStones = 0;
  let whiteStones = 0;
  for (let i = 0; i < stones.length; i++) {
    if (stones[i] === BLACK) blackStones++;
    else if (stones[i] === WHITE) whiteStones++;
  }

  // Flood-fill delle regioni vuote: una regione è territorio di un colore solo se
  // confina esclusivamente con quel colore.
  const seen = new Uint8Array(stones.length);
  const territory = { black: 0, white: 0, dame: 0 };
  for (let i = 0; i < stones.length; i++) {
    if (stones[i] !== EMPTY || seen[i]) continue;
    const region = [];
    const borders = new Set();
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop();
      region.push(j);
      for (const n of neighbors(size, j)) {
        if (stones[n] === EMPTY) {
          if (!seen[n]) {
            seen[n] = 1;
            stack.push(n);
          }
        } else {
          borders.add(stones[n]);
        }
      }
    }
    if (borders.has(BLACK) && !borders.has(WHITE)) territory.black += region.length;
    else if (borders.has(WHITE) && !borders.has(BLACK)) territory.white += region.length;
    else territory.dame += region.length;
  }

  const black = blackStones + territory.black;
  const white = whiteStones + territory.white + komi;

  let result;
  const diff = black - white;
  if (diff > 0) result = `B+${trim(diff)}`;
  else if (diff < 0) result = `W+${trim(-diff)}`;
  else result = 'Draw';

  return { black, white, territory, result };
}

function trim(n) {
  // 7 → "7", 7.5 → "7.5"
  return Number.isInteger(n) ? String(n) : String(n);
}
