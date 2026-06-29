import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chmodSync } from 'node:fs';

// Usa il finto motore GTP (risponde sempre pass) prima di importare l'app.
const __dirname = dirname(fileURLToPath(import.meta.url));
process.env.GNUGO_BIN = join(__dirname, '..', 'fixtures', 'fake-gnugo.mjs');
process.env.COOKIE_SECRET = 'test-secret';

const { createApp } = await import('../../src/server.js');
const { createTestDb } = await import('../../src/db/index.js');

let server;
let base;

before(async () => {
  chmodSync(process.env.GNUGO_BIN, 0o755);
  const app = createApp(createTestDb());
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server?.close(); });

// Estrae i cookie name=value dalle intestazioni set-cookie (cookie-session ne usa 2).
function cookieFrom(res) {
  const all = res.headers.getSetCookie?.() || [];
  return all.map((c) => c.split(';')[0]).join('; ');
}

async function call(method, path, body, cookie) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { res, json: await res.json().catch(() => null), cookie: cookieFrom(res) };
}

test('register → crea partita → mossa illegale e legale', async () => {
  const reg = await call('POST', '/api/auth/register', { username: 'alice', password: 'secret1' });
  assert.equal(reg.res.status, 201);
  const cookie = reg.cookie;
  assert.ok(cookie, 'set-cookie presente');

  const dup = await call('POST', '/api/auth/register', { username: 'alice', password: 'secret1' });
  assert.equal(dup.res.status, 409);

  const create = await call('POST', '/api/games', { board_size: 9, komi: 7.5, color: 'B' }, cookie);
  assert.equal(create.res.status, 201);
  const id = create.json.game.id;
  assert.equal(create.json.game.turn, 'B');

  const m1 = await call('POST', `/api/games/${id}/move`, { x: 2, y: 2 }, cookie);
  assert.equal(m1.res.status, 200);
  assert.equal(m1.json.game.position[2][2], 1);

  const bad = await call('POST', `/api/games/${id}/move`, { x: 2, y: 2 }, cookie);
  assert.equal(bad.res.status, 422);
  assert.equal(bad.json.reason, 'occupied');
});

test('doppio pass → scoring → score-accept → finished', async () => {
  const reg = await call('POST', '/api/auth/register', { username: 'bob', password: 'secret1' });
  const cookie = reg.cookie;
  const create = await call('POST', '/api/games', { board_size: 9, komi: 7.5, color: 'B' }, cookie);
  const id = create.json.game.id;

  const p = await call('POST', `/api/games/${id}/pass`, {}, cookie);
  assert.equal(p.json.game.status, 'scoring');

  const acc = await call('POST', `/api/games/${id}/score-accept`, {}, cookie);
  assert.equal(acc.res.status, 200);
  assert.equal(acc.json.game.status, 'finished');
  assert.match(acc.json.result, /^[BW]\+|^Draw/);
});

test('accesso non autenticato è rifiutato', async () => {
  const r = await call('GET', '/api/games/1');
  assert.equal(r.res.status, 401);
});
