// Bootstrap server play-go: Express, sessione cookie firmata, static PWA, API.

import express from 'express';
import cookieSession from 'cookie-session';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './db/index.js';
import { authRouter } from './routes/auth.js';
import { gamesRouter } from './routes/games.js';
import { learnRouter } from './routes/learn.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp(db = getDb()) {
  const app = express();
  app.set('trust proxy', 1); // dietro Cloudflare/nginx
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieSession({
    name: 'pg_sess',
    keys: [process.env.COOKIE_SECRET || 'dev-secret-change-me'],
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter(db));
  app.use('/api/games', gamesRouter(db));
  app.use('/api/modules', learnRouter(db));

  app.use(express.static(join(__dirname, 'public')));

  // Error handler uniforme.
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'internal', message: 'Errore interno' });
  });

  return app;
}

// Avvio diretto (non in import per i test).
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 3504);
  const host = process.env.HOST || '127.0.0.1';
  createApp().listen(port, host, () => {
    console.log(`play-go in ascolto su http://${host}:${port}`);
  });
}
