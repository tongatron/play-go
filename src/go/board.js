// Motore di gioco PURO — nessun import di rete, DB o UI (Constitution III).
// Rappresenta lo stato della goban e applica le regole locali di una mossa:
// posa, libertà, cattura, divieto di suicidio. Il divieto di ripetizione
// (ko/superko) è gestito a livello superiore in ./ko.js usando l'history.

export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

/** Colore avversario. Accetta 'B'/'W' o BLACK/WHITE. */
export function other(color) {
  if (color === 'B' || color === BLACK) return color === 'B' ? 'W' : WHITE;
  if (color === 'W' || color === WHITE) return color === 'W' ? 'B' : BLACK;
  throw new Error(`colore non valido: ${color}`);
}

/** Converte 'B'/'W' nel codice numerico interno. */
export function code(color) {
  if (color === 'B' || color === BLACK) return BLACK;
  if (color === 'W' || color === WHITE) return WHITE;
  throw new Error(`colore non valido: ${color}`);
}

/** Crea una posizione vuota. */
export function createBoard(size = 9) {
  if (![9, 13, 19].includes(size)) throw new Error(`dimensione non supportata: ${size}`);
  return { size, stones: new Uint8Array(size * size), toMove: 'B' };
}

export function idx(size, x, y) {
  return y * size + x;
}

export function inBounds(size, x, y) {
  return x >= 0 && y >= 0 && x < size && y < size;
}

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
 * Gruppo connesso a `start` (stesso colore) e relative libertà.
 * @returns {{group:number[], liberties:Set<number>}}
 */
export function groupAndLiberties(stones, size, start) {
  const color = stones[start];
  const group = [];
  const liberties = new Set();
  const seen = new Uint8Array(stones.length);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop();
    group.push(i);
    for (const n of neighbors(size, i)) {
      if (stones[n] === EMPTY) liberties.add(n);
      else if (stones[n] === color && !seen[n]) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return { group, liberties };
}

/** Errore di mossa illegale con codice macchina (vedi contracts/api.md). */
export class IllegalMove extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'IllegalMove';
    this.reason = reason; // 'occupied' | 'suicide' | 'out_of_bounds'
  }
}

/**
 * Applica una mossa di posa. Funzione PURA: non muta `position`.
 * Non controlla ko/superko (responsabilità di ./ko.js + history).
 * @returns {{position:object, captures:number[]}} captures = indici rimossi
 * @throws {IllegalMove} per occupied / out_of_bounds / suicide
 */
export function applyMove(position, x, y, color) {
  const { size } = position;
  if (!inBounds(size, x, y)) throw new IllegalMove('out_of_bounds');
  const i = idx(size, x, y);
  if (position.stones[i] !== EMPTY) throw new IllegalMove('occupied');

  const me = code(color);
  const opp = me === BLACK ? WHITE : BLACK;
  const stones = position.stones.slice();
  stones[i] = me;

  // 1) Cattura: rimuovi gruppi avversari adiacenti senza libertà.
  const captures = [];
  const checked = new Uint8Array(stones.length);
  for (const n of neighbors(size, i)) {
    if (stones[n] === opp && !checked[n]) {
      const { group, liberties } = groupAndLiberties(stones, size, n);
      for (const g of group) checked[g] = 1;
      if (liberties.size === 0) {
        for (const g of group) {
          stones[g] = EMPTY;
          captures.push(g);
        }
      }
    }
  }

  // 2) Suicidio: se dopo le catture il mio gruppo non ha libertà → illegale.
  if (captures.length === 0) {
    const { liberties } = groupAndLiberties(stones, size, i);
    if (liberties.size === 0) throw new IllegalMove('suicide');
  }

  return {
    position: { size, stones, toMove: me === BLACK ? 'W' : 'B' },
    captures,
  };
}

/** Posa "di servizio" (setup/handicap): nessun controllo regole, muta una copia. */
export function placeStone(position, x, y, color) {
  const stones = position.stones.slice();
  stones[idx(position.size, x, y)] = code(color);
  return { ...position, stones };
}
