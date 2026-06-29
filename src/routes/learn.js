// Percorso didattico (US2): elenco moduli con sblocco da prerequisiti, lezioni,
// e validazione esercizi tramite il motore puro (Constitution III/IV). I progressi
// sono persistiti in module_progress; gli esercizi risolti durante una sessione
// sono tracciati nel cookie di sessione finché il modulo non è completato.

import { Router } from 'express';
import { requireAuth } from './auth.js';
import { allModules, getModule, getModulePublic, exerciseOf } from '../content/index.js';
import { createBoard, placeStone, applyMove } from '../go/board.js';

export function learnRouter(db) {
  const router = Router();
  router.use(requireAuth);

  const completedSet = (userId) => new Set(
    db.prepare("SELECT module_id FROM module_progress WHERE user_id=? AND status='completed'")
      .all(userId).map((r) => r.module_id),
  );

  // Elenco moduli con stato sblocco/completamento
  router.get('/', (req, res) => {
    const done = completedSet(req.session.userId);
    const list = allModules().map((m) => ({
      id: m.id,
      order: m.order,
      title: m.title,
      prerequisites: m.prerequisites,
      completed: done.has(m.id),
      unlocked: m.prerequisites.every((p) => done.has(p)),
    }));
    res.json({ modules: list });
  });

  // Dettaglio modulo (senza soluzioni), solo se sbloccato
  router.get('/:id', (req, res) => {
    const m = getModule(req.params.id);
    if (!m) return res.status(404).json({ error: 'not_found' });
    const done = completedSet(req.session.userId);
    if (!m.prerequisites.every((p) => done.has(p))) {
      return res.status(403).json({ error: 'locked', message: 'Completa prima i moduli richiesti' });
    }
    res.json({ module: getModulePublic(req.params.id), completed: done.has(m.id) });
  });

  // Tentativo di soluzione di un esercizio
  router.post('/:id/attempt', (req, res) => {
    const moduleId = req.params.id;
    const { exerciseId, x, y } = req.body || {};
    const ex = exerciseOf(moduleId, exerciseId);
    if (!ex) return res.status(404).json({ error: 'exercise_not_found' });

    // Ricostruisci la posizione e verifica che la mossa sia legale.
    let position = createBoard(ex.size);
    for (const s of ex.setup) position = placeStone(position, s.x, s.y, s.color);
    let legal = true;
    try { applyMove(position, Number(x), Number(y), ex.toMove); }
    catch { legal = false; }

    const correct = legal && ex.solution.some((p) => p.x === Number(x) && p.y === Number(y));
    if (!correct) {
      return res.json({ correct: false, feedback: ex.noText });
    }

    // Registra l'esercizio risolto nella sessione.
    const solved = req.session.solved || {};
    const set = new Set(solved[moduleId] || []);
    set.add(exerciseId);
    solved[moduleId] = [...set];
    req.session.solved = solved;

    // Modulo completato quando tutti gli esercizi sono stati risolti.
    const allIds = getModule(moduleId).exercises.map((e) => e.id);
    const moduleCompleted = allIds.every((eid) => set.has(eid));
    if (moduleCompleted) {
      db.prepare(`INSERT INTO module_progress (user_id, module_id, status, completed_at)
                  VALUES (?, ?, 'completed', ?)
                  ON CONFLICT(user_id, module_id) DO UPDATE SET status='completed', completed_at=excluded.completed_at`)
        .run(req.session.userId, moduleId, new Date().toISOString());
    }

    res.json({ correct: true, feedback: ex.okText, moduleCompleted });
  });

  return router;
}
