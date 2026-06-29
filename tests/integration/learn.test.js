import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, placeStone, applyMove } from '../../src/go/board.js';
import { allModules } from '../../src/content/index.js';

process.env.COOKIE_SECRET = 'test-secret';
const { createApp } = await import('../../src/server.js');
const { createTestDb } = await import('../../src/db/index.js');

let server, base;
before(async () => {
  const app = createApp(createTestDb());
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server?.close());

function cookieFrom(res) {
  return (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
}
async function call(method, path, body, cookie) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { res, json: await res.json().catch(() => null), cookie: cookieFrom(res) || cookie };
}

// Verifica che ogni soluzione dichiarata sia davvero una mossa legale per il
// colore di turno (rete di sicurezza sui contenuti).
test('le soluzioni dei moduli sono mosse legali', () => {
  for (const m of allModules()) {
    for (const ex of m.exercises) {
      let pos = createBoard(ex.size);
      for (const s of ex.setup) pos = placeStone(pos, s.x, s.y, s.color);
      for (const sol of ex.solution) {
        assert.doesNotThrow(
          () => applyMove(pos, sol.x, sol.y, ex.toMove),
          `soluzione illegale in ${m.id}/${ex.id} @ ${sol.x},${sol.y}`,
        );
      }
    }
  }
});

test('flusso didattico: sblocco, attempt errato/corretto, completamento persistito', async () => {
  const reg = await call('POST', '/api/auth/register', { username: 'lerner', password: 'secret1' });
  const cookie = reg.cookie;

  // Stato iniziale: primo modulo sbloccato, gli altri bloccati.
  const list = await call('GET', '/api/modules', null, cookie);
  const first = list.json.modules.find((m) => m.order === 1);
  const second = list.json.modules.find((m) => m.order === 2);
  assert.equal(first.unlocked, true);
  assert.equal(first.completed, false);
  assert.equal(second.unlocked, false, 'il secondo modulo parte bloccato');

  // Dettaglio modulo: niente soluzioni esposte.
  const detail = await call('GET', `/api/modules/${first.id}`, null, cookie);
  assert.ok(detail.json.module.exercises.length >= 1);
  assert.equal(detail.json.module.exercises[0].solution, undefined, 'soluzione non inviata al client');

  // Modulo bloccato → 403.
  const locked = await call('GET', `/api/modules/${second.id}`, null, cookie);
  assert.equal(locked.res.status, 403);

  // Attempt errato.
  const exId = detail.json.module.exercises[0].id;
  const wrong = await call('POST', `/api/modules/${first.id}/attempt`, { exerciseId: exId, x: 8, y: 8 }, cookie);
  assert.equal(wrong.json.correct, false);

  // Risolvi tutti gli esercizi del primo modulo con le soluzioni reali.
  const full = allModules().find((m) => m.id === first.id);
  let last;
  for (const ex of full.exercises) {
    const sol = ex.solution[0];
    last = await call('POST', `/api/modules/${first.id}/attempt`, { exerciseId: ex.id, x: sol.x, y: sol.y }, cookie);
    assert.equal(last.json.correct, true);
  }
  assert.equal(last.json.moduleCompleted, true);

  // Persistenza: dopo un nuovo login il modulo risulta completato e il 2° sbloccato.
  await call('POST', '/api/auth/logout', null, cookie);
  const relog = await call('POST', '/api/auth/login', { username: 'lerner', password: 'secret1' });
  const list2 = await call('GET', '/api/modules', null, relog.cookie);
  const first2 = list2.json.modules.find((m) => m.id === first.id);
  const second2 = list2.json.modules.find((m) => m.order === 2);
  assert.equal(first2.completed, true, 'completamento persistito');
  assert.equal(second2.unlocked, true, 'prerequisito soddisfatto → 2° sbloccato');
});
