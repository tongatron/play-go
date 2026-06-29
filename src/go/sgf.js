// Import/export SGF (Smart Game Format) e replay. Sottoinsieme sufficiente per
// l'MVP: dimensione, komi, risultato e sequenza di mosse B/W (posa o pass).
// Coordinate SGF: lettere minuscole, 'a'=0 (origine in alto a sinistra).

import { createBoard } from './board.js';
import { applyMoveWithKo, positionHash } from './ko.js';

const A = 'a'.charCodeAt(0);

export function coordToSgf(x, y) {
  return String.fromCharCode(A + x) + String.fromCharCode(A + y);
}

export function sgfToCoord(s) {
  return { x: s.charCodeAt(0) - A, y: s.charCodeAt(1) - A };
}

/**
 * Serializza una partita in SGF.
 * @param {{size:number, komi:number, moves:Array, result?:string}} game
 *   moves: [{color:'B'|'W', kind:'play'|'pass'|'resign', x?,y?}]
 */
export function toSGF({ size, komi, moves = [], result } = {}) {
  let out = `(;FF[4]GM[1]SZ[size]`.replace('size', size);
  if (komi != null) out += `KM[${komi}]`;
  if (result) out += `RE[${result}]`;
  for (const m of moves) {
    if (m.kind === 'resign') continue; // il risultato è in RE
    const coord = m.kind === 'pass' ? '' : coordToSgf(m.x, m.y);
    out += `;${m.color}[${coord}]`;
  }
  return out + ')';
}

/**
 * Parsing di un SGF (sottoinsieme). Estrae size, komi, result e mosse.
 * @returns {{size:number, komi:number, result:string|null, moves:Array}}
 */
export function fromSGF(text) {
  const size = parseInt((text.match(/SZ\[(\d+)\]/) || [])[1] || '19', 10);
  const komi = parseFloat((text.match(/KM\[([\d.]+)\]/) || [])[1] || 'NaN');
  const result = (text.match(/RE\[([^\]]*)\]/) || [])[1] || null;
  const moves = [];
  const re = /;([BW])\[([a-z]{0,2})\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const color = m[1];
    const coord = m[2];
    if (coord === '') moves.push({ color, kind: 'pass' });
    else {
      const { x, y } = sgfToCoord(coord);
      moves.push({ color, kind: 'play', x, y });
    }
  }
  return { size, komi: Number.isNaN(komi) ? undefined : komi, result, moves };
}

/**
 * Riproduce le mosse partendo da una board vuota, applicando regole + superko.
 * @returns {{position:object, positions:object[], history:Set<string>}}
 *   positions[k] = stato DOPO la k-esima mossa (positions[0] = board vuota)
 * @throws se una mossa nel record è illegale (record corrotto)
 */
export function replayPositions({ size, moves = [] }) {
  let position = createBoard(size);
  const history = new Set([positionHash(position)]);
  const positions = [position];
  for (const m of moves) {
    if (m.kind === 'pass') {
      position = { ...position, toMove: position.toMove === 'B' ? 'W' : 'B' };
    } else if (m.kind === 'play') {
      const r = applyMoveWithKo(position, m.x, m.y, m.color, history);
      position = r.position;
      history.add(r.hash);
    }
    positions.push(position);
  }
  return { position, positions, history };
}
