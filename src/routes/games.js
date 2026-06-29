// Partite vs computer (US1). Le mosse async (US3) riusano move/pass/resign.
// Validazione mosse sempre lato server tramite src/go/ (Constitution III).

import { Router } from 'express';
import { requireAuth } from './auth.js';
import { newSgf, play, pass, stateOf, toClientPosition } from '../game/engine.js';
import { score } from '../go/score.js';
import { genMove, AiUnavailable } from '../ai/gnugo.js';
import { IllegalMove } from '../go/board.js';
import { KoViolation } from '../go/ko.js';

const GNUGO_BIN = process.env.GNUGO_BIN || 'gnugo';
const MAX_CONCURRENT_AI = Number(process.env.MAX_CONCURRENT_AI || 3); // Constitution I
let activeAi = 0;

function other(c) { return c === 'B' ? 'W' : 'B'; }

function gameView(row) {
  const { position, turn, moves } = stateOf({ size: row.board_size, sgf: row.sgf });
  return {
    id: row.id,
    type: row.type,
    board_size: row.board_size,
    komi: row.komi,
    status: row.status,
    turn: row.status === 'playing' ? turn : row.turn,
    result: row.result,
    ai_level: row.ai_level,
    ai_color: row.ai_color,
    moveCount: moves.length,
    position: toClientPosition(position),
    sgf: row.sgf,
  };
}

export function gamesRouter(db) {
  const router = Router();
  router.use(requireAuth);

  const getGame = (id) => db.prepare('SELECT * FROM game WHERE id = ?').get(id);
  const canAccess = (row, userId) =>
    row && (row.black_user_id === userId || row.white_user_id === userId);

  // Crea partita vs computer
  router.post('/', async (req, res) => {
    const userId = req.session.userId;
    const { board_size = 9, komi = 7.5, ai_level = 10, color = 'B', type = 'vs_computer' } = req.body || {};
    if (type !== 'vs_computer') return res.status(400).json({ error: 'unsupported_type' });
    if (![9, 13].includes(Number(board_size))) return res.status(400).json({ error: 'bad_board_size' });
    const humanColor = color === 'W' ? 'W' : 'B';
    const aiColor = other(humanColor);
    const now = new Date().toISOString();
    const info = db.prepare(`
      INSERT INTO game (type, board_size, komi, black_user_id, white_user_id, ai_level, ai_color, status, turn, sgf, created_at, updated_at)
      VALUES (@type, @size, @komi, @black, @white, @level, @aiColor, 'playing', 'B', @sgf, @now, @now)
    `).run({
      type: 'vs_computer', size: Number(board_size), komi: Number(komi),
      black: humanColor === 'B' ? userId : null,
      white: humanColor === 'W' ? userId : null,
      level: Number(ai_level), aiColor, sgf: newSgf(Number(board_size), Number(komi)), now,
    });
    let row = getGame(info.lastInsertRowid);

    // Se l'AI è il Nero, muove per prima.
    if (aiColor === 'B') {
      try { row = await aiRespond(db, row); }
      catch (e) { if (e instanceof AiUnavailable) return res.status(503).json({ error: 'ai_unavailable', message: e.message }); throw e; }
    }
    res.status(201).json({ game: gameView(row) });
  });

  // Dettaglio partita
  router.get('/:id', (req, res) => {
    const row = getGame(req.params.id);
    if (!canAccess(row, req.session.userId)) return res.status(404).json({ error: 'not_found' });
    res.json({ game: gameView(row) });
  });

  // Esporta SGF
  router.get('/:id/sgf', (req, res) => {
    const row = getGame(req.params.id);
    if (!canAccess(row, req.session.userId)) return res.status(404).json({ error: 'not_found' });
    res.type('application/x-go-sgf').send(row.sgf);
  });

  // Mossa
  router.post('/:id/move', async (req, res) => {
    const row = getGame(req.params.id);
    if (!canAccess(row, req.session.userId)) return res.status(404).json({ error: 'not_found' });
    if (row.status !== 'playing') return res.status(409).json({ error: 'not_playing' });
    const myColor = row.black_user_id === req.session.userId ? 'B' : 'W';
    const { x, y } = req.body || {};
    try {
      const r = play(row, myColor, Number(x), Number(y));
      updateSgf(db, row.id, r.sgf, r.nextTurn);
      let updated = getGame(row.id);
      // Risposta AI se è il suo turno
      if (updated.type === 'vs_computer' && updated.status === 'playing') {
        try { updated = await aiRespond(db, updated); }
        catch (e) {
          if (e instanceof AiUnavailable) return res.status(503).json({ error: 'ai_unavailable', message: e.message, game: gameView(updated) });
          throw e;
        }
      }
      res.json({ game: gameView(updated) });
    } catch (e) {
      if (e instanceof IllegalMove || e instanceof KoViolation || e.reason) {
        return res.status(422).json({ error: 'illegal_move', reason: e.reason });
      }
      throw e;
    }
  });

  // Pass
  router.post('/:id/pass', async (req, res) => {
    const row = getGame(req.params.id);
    if (!canAccess(row, req.session.userId)) return res.status(404).json({ error: 'not_found' });
    if (row.status !== 'playing') return res.status(409).json({ error: 'not_playing' });
    const myColor = row.black_user_id === req.session.userId ? 'B' : 'W';
    try {
      const r = pass(row, myColor);
      if (r.doublePass) { setScoring(db, row.id, r.sgf); return res.json({ game: gameView(getGame(row.id)) }); }
      updateSgf(db, row.id, r.sgf, r.nextTurn);
      let updated = getGame(row.id);
      if (updated.type === 'vs_computer' && updated.status === 'playing') {
        try { updated = await aiRespond(db, updated); }
        catch (e) { if (e instanceof AiUnavailable) return res.status(503).json({ error: 'ai_unavailable', message: e.message, game: gameView(updated) }); throw e; }
      }
      res.json({ game: gameView(updated) });
    } catch (e) {
      if (e.reason === 'not_your_turn') return res.status(409).json({ error: 'not_your_turn' });
      throw e;
    }
  });

  // Resa
  router.post('/:id/resign', (req, res) => {
    const row = getGame(req.params.id);
    if (!canAccess(row, req.session.userId)) return res.status(404).json({ error: 'not_found' });
    if (row.status !== 'playing') return res.status(409).json({ error: 'not_playing' });
    const myColor = row.black_user_id === req.session.userId ? 'B' : 'W';
    const result = `${other(myColor)}+R`;
    db.prepare("UPDATE game SET status='finished', result=?, updated_at=? WHERE id=?")
      .run(result, new Date().toISOString(), row.id);
    res.json({ game: gameView(getGame(row.id)) });
  });

  // Marcatura pietre morte (fase scoring)
  router.post('/:id/dead-stones', (req, res) => {
    const row = getGame(req.params.id);
    if (!canAccess(row, req.session.userId)) return res.status(404).json({ error: 'not_found' });
    if (row.status !== 'scoring') return res.status(409).json({ error: 'not_scoring' });
    const points = Array.isArray(req.body?.points) ? req.body.points : [];
    db.prepare('UPDATE game SET dead_black=?, score_black_ok=0, score_white_ok=0, updated_at=? WHERE id=?')
      .run(JSON.stringify(points), new Date().toISOString(), row.id);
    res.json({ game: gameView(getGame(row.id)), dead: points });
  });

  // Conferma punteggio
  router.post('/:id/score-accept', (req, res) => {
    const row = getGame(req.params.id);
    if (!canAccess(row, req.session.userId)) return res.status(404).json({ error: 'not_found' });
    if (row.status !== 'scoring') return res.status(409).json({ error: 'not_scoring' });
    // vs_computer: l'AI accetta automaticamente.
    const dead = row.dead_black ? JSON.parse(row.dead_black) : [];
    const { position } = stateOf({ size: row.board_size, sgf: row.sgf });
    const result = score(position, { komi: row.komi, dead }).result;
    db.prepare("UPDATE game SET status='finished', result=?, score_black_ok=1, score_white_ok=1, updated_at=? WHERE id=?")
      .run(result, new Date().toISOString(), row.id);
    res.json({ game: gameView(getGame(row.id)), result });
  });

  return router;
}

function updateSgf(db, id, sgf, nextTurn) {
  db.prepare('UPDATE game SET sgf=?, turn=?, updated_at=? WHERE id=?')
    .run(sgf, nextTurn, new Date().toISOString(), id);
}

function setScoring(db, id, sgf) {
  db.prepare("UPDATE game SET sgf=?, status='scoring', updated_at=? WHERE id=?")
    .run(sgf, new Date().toISOString(), id);
}

/** Genera e applica la mossa dell'AI sul row corrente; ritorna il row aggiornato. */
async function aiRespond(db, row) {
  if (activeAi >= MAX_CONCURRENT_AI) throw new AiUnavailable('troppe partite AI simultanee');
  activeAi++;
  try {
    const { moves } = stateOf({ size: row.board_size, sgf: row.sgf });
    const move = await genMove({
      size: row.board_size, komi: row.komi, moves,
      color: row.ai_color, level: row.ai_level, bin: GNUGO_BIN,
    });
    if (move.kind === 'resign') {
      const result = `${other(row.ai_color)}+R`;
      db.prepare("UPDATE game SET status='finished', result=?, updated_at=? WHERE id=?")
        .run(result, new Date().toISOString(), row.id);
      return db.prepare('SELECT * FROM game WHERE id = ?').get(row.id);
    }
    if (move.kind === 'pass') {
      const r = pass(row, row.ai_color);
      if (r.doublePass) setScoring(db, row.id, r.sgf);
      else updateSgf(db, row.id, r.sgf, r.nextTurn);
      return db.prepare('SELECT * FROM game WHERE id = ?').get(row.id);
    }
    const r = play(row, row.ai_color, move.x, move.y);
    updateSgf(db, row.id, r.sgf, r.nextTurn);
    return db.prepare('SELECT * FROM game WHERE id = ?').get(row.id);
  } finally {
    activeAi--;
  }
}
