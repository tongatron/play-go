// Registrazione / login / logout. Identità minimale: nome utente + password
// (Constitution V). Hash argon2id; nessuna email ⇒ nessun recupero password.

import { Router } from 'express';
import argon2 from 'argon2';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const MIN_PASSWORD = 6;

export function authRouter(db) {
  const router = Router();

  router.post('/register', async (req, res) => {
    const { username, password } = req.body || {};
    if (!USERNAME_RE.test(username || '')) {
      return res.status(400).json({ error: 'invalid_username', message: '3-20 caratteri: lettere, numeri, underscore' });
    }
    if (!password || password.length < MIN_PASSWORD) {
      return res.status(400).json({ error: 'invalid_password', message: `Almeno ${MIN_PASSWORD} caratteri` });
    }
    const exists = db.prepare('SELECT id FROM user WHERE username = ?').get(username);
    if (exists) {
      return res.status(409).json({ error: 'username_taken', message: 'Nome utente già in uso' });
    }
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    const info = db
      .prepare('INSERT INTO user (username, password_hash, created_at) VALUES (?, ?, ?)')
      .run(username, hash, new Date().toISOString());
    req.session.userId = info.lastInsertRowid;
    res.status(201).json({ user: { id: info.lastInsertRowid, username } });
  });

  router.post('/login', async (req, res) => {
    const { username, password } = req.body || {};
    const row = db.prepare('SELECT id, username, password_hash FROM user WHERE username = ?').get(username || '');
    if (!row || !(await argon2.verify(row.password_hash, password || ''))) {
      return res.status(401).json({ error: 'bad_credentials', message: 'Credenziali non valide' });
    }
    req.session.userId = row.id;
    res.json({ user: { id: row.id, username: row.username } });
  });

  router.post('/logout', (req, res) => {
    req.session = null;
    res.status(204).end();
  });

  router.get('/me', (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'unauthenticated' });
    const row = db.prepare('SELECT id, username FROM user WHERE id = ?').get(req.session.userId);
    if (!row) return res.status(401).json({ error: 'unauthenticated' });
    res.json({ user: row });
  });

  return router;
}

/** Middleware: richiede sessione autenticata. */
export function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'unauthenticated', message: 'Accesso richiesto' });
  next();
}
