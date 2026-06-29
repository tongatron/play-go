// Connessione SQLite (better-sqlite3) + runner di migrazioni minimale.
// Le migrazioni sono file .sql in ./migrations/ applicati in ordine; lo stato è
// tracciato con PRAGMA user_version (numero progressivo).

import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

let db;

export function getDb() {
  if (db) return db;
  const file = process.env.DB_PATH || join(process.cwd(), 'data', 'play-go.db');
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(database) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const current = database.pragma('user_version', { simple: true });
  files.forEach((f, i) => {
    const version = i + 1;
    if (version <= current) return;
    const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
    database.exec('BEGIN');
    try {
      database.exec(sql);
      database.pragma(`user_version = ${version}`);
      database.exec('COMMIT');
    } catch (err) {
      database.exec('ROLLBACK');
      throw new Error(`migrazione ${f} fallita: ${err.message}`);
    }
  });
}

/** Solo per i test: usa un DB in memoria isolato. */
export function createTestDb() {
  const mem = new Database(':memory:');
  mem.pragma('foreign_keys = ON');
  migrate(mem);
  return mem;
}
