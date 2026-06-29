// Carica i moduli didattici dai file JSON in ./modules/. Le soluzioni degli
// esercizi NON vengono mai inviate al client: la validazione è server-side.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, 'modules');

let cache = null;

function load() {
  if (cache) return cache;
  const mods = readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')))
    .sort((a, b) => a.order - b.order);
  cache = new Map(mods.map((m) => [m.id, m]));
  return cache;
}

/** Tutti i moduli in ordine (oggetti completi, uso interno). */
export function allModules() {
  return [...load().values()];
}

export function getModule(id) {
  return load().get(id) || null;
}

/** Versione esercizio senza soluzione (sicura per il client). */
function publicExercise(ex) {
  const { solution, ...rest } = ex;
  return rest;
}

/** Modulo senza soluzioni, per il client. */
export function getModulePublic(id) {
  const m = getModule(id);
  if (!m) return null;
  return { ...m, exercises: m.exercises.map(publicExercise) };
}

export function exerciseOf(moduleId, exerciseId) {
  return getModule(moduleId)?.exercises.find((e) => e.id === exerciseId) || null;
}
