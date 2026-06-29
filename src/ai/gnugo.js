// Avversario computer: GNU Go pilotato in GTP (Go Text Protocol).
// Strategia footprint-minimo (Constitution I): processo spawnato ON-DEMAND per la
// singola mossa, lo stato è ricostruito replayando tutte le mosse, poi il processo
// viene terminato. Nessun processo AI residente.

import { spawn } from 'node:child_process';

// Lettere colonna GTP: A..T saltando 'I'.
const GTP_COLS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';

/** (x,y) top-left 0-index  →  vertice GTP (es. {3,5} su 9x9 → "D4"). */
export function toGtpVertex(x, y, size) {
  return GTP_COLS[x] + (size - y);
}

/** vertice GTP → (x,y) top-left 0-index. "PASS"/"RESIGN" gestiti dal chiamante. */
export function fromGtpVertex(v, size) {
  const col = GTP_COLS.indexOf(v[0].toUpperCase());
  const row = parseInt(v.slice(1), 10);
  return { x: col, y: size - row };
}

export class AiUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = 'AiUnavailable';
  }
}

/**
 * Chiede a GNU Go la mossa per `color`, dato lo storico della partita.
 * @param {object} p
 * @param {number} p.size 9|13
 * @param {number} p.komi
 * @param {Array}  p.moves storico [{color:'B'|'W', kind, x?, y?}]
 * @param {string} p.color 'B'|'W' colore da muovere (lato AI)
 * @param {number} [p.level=10] livello GNU Go (1=debole .. 10=forte)
 * @param {number} [p.timeoutMs=8000]
 * @param {string} [p.bin='gnugo']
 * @returns {Promise<{kind:'play'|'pass'|'resign', x?:number, y?:number}>}
 */
export function genMove({ size, komi, moves = [], color, level = 10, timeoutMs = 8000, bin = 'gnugo' }) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(bin, ['--mode', 'gtp', '--level', String(level)], {
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    } catch (err) {
      return reject(new AiUnavailable(`impossibile avviare ${bin}: ${err.message}`));
    }

    let out = '';
    const responses = [];
    let settled = false;

    const done = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child.kill('SIGKILL'); } catch { /* già terminato */ }
      fn(arg);
    };

    const timer = setTimeout(
      () => done(reject, new AiUnavailable('timeout GNU Go')),
      timeoutMs,
    );

    child.on('error', (err) => done(reject, new AiUnavailable(`GNU Go: ${err.message}`)));

    child.stdout.on('data', (chunk) => {
      out += chunk.toString();
      // Ogni risposta GTP termina con una riga vuota (doppio \n).
      let nl;
      while ((nl = out.indexOf('\n\n')) !== -1) {
        responses.push(out.slice(0, nl).trim());
        out = out.slice(nl + 2);
      }
      // L'ultima risposta è quella di genmove (ultimo comando inviato).
      if (responses.length >= commands.length) {
        const last = responses[commands.length - 1] || responses[responses.length - 1];
        const m = (last || '').replace(/^=\s*/, '').trim().toUpperCase();
        if (!m) return; // attendi ancora
        if (m === 'PASS') return done(resolve, { kind: 'pass' });
        if (m === 'RESIGN') return done(resolve, { kind: 'resign' });
        const { x, y } = fromGtpVertex(m, size);
        return done(resolve, { kind: 'play', x, y });
      }
    });

    // Costruisci la sequenza di comandi GTP.
    const commands = [`boardsize ${size}`, 'clear_board', `komi ${komi}`];
    for (const mv of moves) {
      if (mv.kind === 'pass') commands.push(`play ${mv.color} pass`);
      else if (mv.kind === 'play') commands.push(`play ${mv.color} ${toGtpVertex(mv.x, mv.y, size)}`);
    }
    commands.push(`genmove ${color}`);

    child.stdin.write(commands.map((c) => c + '\n').join(''));
    child.stdin.end();
  });
}
