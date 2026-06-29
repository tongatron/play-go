// Logica frontend: auth, creazione partita, gioco vs computer. Vanilla JS.
import { Goban } from '/goban.js';

const $ = (s) => document.querySelector(s);
const api = async (method, path, body) => {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
};

let me = null;
let current = null; // game corrente
let myColor = 'B';

const goban = new Goban($('#goban'), {
  size: 9,
  onPoint: (x, y) => onBoardClick(x, y),
});
window.addEventListener('resize', () => goban._resize());

// ---- Viste ----
function show(view) {
  for (const id of ['auth', 'lobby', 'game', 'learn', 'lesson']) $('#' + id).hidden = id !== view;
}

function setLoggedIn(user) {
  me = user;
  $('#nav').hidden = false;
  $('#who').textContent = user.username;
  show('lobby');
}

// ---- Auth ----
let authMode = 'login';
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  authMode = t.dataset.tab;
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
  $('#auth-submit').textContent = authMode === 'login' ? 'Accedi' : 'Registrati';
  $('#auth-note').hidden = authMode !== 'register';
  $('#auth-error').textContent = '';
}));

$('#auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#auth-error').textContent = '';
  const fd = new FormData(e.target);
  const body = { username: fd.get('username'), password: fd.get('password') };
  const r = await api('POST', `/api/auth/${authMode}`, body);
  if (r.ok) { setLoggedIn(r.json.user); e.target.reset(); }
  else $('#auth-error').textContent = r.json?.message || 'Errore';
});

$('#btn-logout').addEventListener('click', async () => {
  await api('POST', '/api/auth/logout');
  me = null; current = null;
  $('#nav').hidden = true;
  show('auth');
});

// ---- Nuova partita ----
$('#btn-new').addEventListener('click', async () => {
  const board_size = Number($('#opt-size').value);
  const color = $('#opt-color').value;
  const ai_level = Number($('#opt-level').value);
  const r = await api('POST', '/api/games', { board_size, color, ai_level });
  if (!r.ok) { alert(r.json?.message || 'Impossibile creare la partita'); return; }
  myColor = color;
  enterGame(r.json.game);
});

$('#btn-back').addEventListener('click', () => show('lobby'));

// ---- Partita ----
function enterGame(game) {
  current = game;
  show('game');            // prima rendi visibile la sezione...
  goban.setSize(game.board_size); // ...poi dimensiona il canvas (ora clientWidth > 0)
  goban.clearDead();
  render(game);
}

function render(game) {
  current = game;
  goban.setPosition(game.position);
  const turnTxt = game.turn === myColor ? 'Tocca a te' : 'Tocca al computer';
  if (game.status === 'playing') $('#status').textContent = `${turnTxt} (${game.turn === 'B' ? 'Nero' : 'Bianco'})`;
  else if (game.status === 'scoring') $('#status').textContent = 'Fine partita — marca le pietre morte';
  else if (game.status === 'finished') $('#status').textContent = `Risultato: ${prettyResult(game.result)}`;
  $('#score-panel').hidden = game.status !== 'scoring';
  $('#btn-pass').disabled = game.status !== 'playing';
  $('#btn-resign').disabled = game.status !== 'playing';
}

function prettyResult(r) {
  if (!r) return '';
  if (r.endsWith('+R')) return `${r[0] === 'B' ? 'Nero' : 'Bianco'} vince per abbandono`;
  const [c, d] = r.split('+');
  return `${c === 'B' ? 'Nero' : 'Bianco'} vince di ${d}`;
}

async function onBoardClick(x, y) {
  if (!current) return;
  if (current.status === 'scoring') {
    goban.toggleDead(y * current.board_size + x);
    await api('POST', `/api/games/${current.id}/dead-stones`, { points: goban.deadList() });
    return;
  }
  if (current.status !== 'playing' || current.turn !== myColor) return;
  const r = await api('POST', `/api/games/${current.id}/move`, { x, y });
  if (r.status === 422) { flashStatus('Mossa non valida: ' + reasonText(r.json.reason)); return; }
  if (r.status === 503) { flashStatus('Computer non disponibile, riprova'); if (r.json?.game) render(r.json.game); return; }
  if (r.ok) render(r.json.game);
}

$('#btn-pass').addEventListener('click', async () => {
  const r = await api('POST', `/api/games/${current.id}/pass`);
  if (r.ok) render(r.json.game);
});
$('#btn-resign').addEventListener('click', async () => {
  if (!confirm('Abbandonare la partita?')) return;
  const r = await api('POST', `/api/games/${current.id}/resign`);
  if (r.ok) render(r.json.game);
});
$('#btn-score').addEventListener('click', async () => {
  const r = await api('POST', `/api/games/${current.id}/score-accept`);
  if (r.ok) render(r.json.game);
});

function reasonText(reason) {
  return ({ occupied: 'casella occupata', suicide: 'suicidio', ko: 'ko', out_of_bounds: 'fuori dalla scacchiera', not_your_turn: 'non è il tuo turno' })[reason] || reason;
}
let flashTimer;
function flashStatus(msg) {
  const prev = $('#status').textContent;
  $('#status').textContent = msg;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => render(current), 1800);
}

// ---- Bootstrap: sessione esistente? ----
(async () => {
  const r = await api('GET', '/api/auth/me');
  if (r.ok) setLoggedIn(r.json.user);
  else show('auth');
})();

// ============================ DIDATTICA (US2) ============================
const exGoban = new Goban($('#ex-goban'), { size: 9, onPoint: (x, y) => onExerciseClick(x, y) });
let lessonModule = null;   // modulo aperto (con esercizi, senza soluzioni)
let exIndex = 0;           // esercizio corrente
let exSolved = false;      // esercizio corrente già risolto?

$('#btn-learn').addEventListener('click', loadModules);
document.querySelectorAll('[data-go]').forEach((b) =>
  b.addEventListener('click', () => { const v = b.dataset.go; if (v === 'learn') loadModules(); else show(v); }));
$('#ex-retry').addEventListener('click', () => showExercise(exIndex));

async function loadModules() {
  const r = await api('GET', '/api/modules');
  if (!r.ok) return;
  const ul = $('#module-list');
  ul.innerHTML = '';
  for (const m of r.json.modules) {
    const li = document.createElement('li');
    li.className = 'module' + (m.unlocked ? '' : ' locked') + (m.completed ? ' done' : '');
    const badge = m.completed ? '✓' : (m.unlocked ? '▶' : '🔒');
    li.innerHTML = `<span class="badge">${badge}</span><span class="m-title">${m.order}. ${escapeHtml(m.title)}</span>`;
    if (m.unlocked) li.addEventListener('click', () => openLesson(m.id));
    ul.appendChild(li);
  }
  show('learn');
}

async function openLesson(id) {
  const r = await api('GET', `/api/modules/${id}`);
  if (!r.ok) { alert(r.json?.message || 'Modulo non disponibile'); return; }
  lessonModule = r.json.module;
  $('#lesson-title').textContent = lessonModule.title;
  $('#lesson-text').innerHTML = lessonModule.lesson.map((p) => `<p>${mdLite(p)}</p>`).join('');
  exIndex = 0;
  show('lesson');
  if (lessonModule.exercises.length) startExercise(0);
  else $('#exercise').hidden = true;
}

function startExercise(i) {
  $('#exercise').hidden = false;
  // dimensiona la goban DOPO che la sezione è visibile (stesso accorgimento del gioco)
  exGoban.setSize(lessonModule.exercises[i].size);
  showExercise(i);
}

function showExercise(i) {
  const ex = lessonModule.exercises[i];
  exIndex = i;
  exSolved = false;
  $('#ex-num').textContent = `${i + 1} / ${lessonModule.exercises.length}`;
  $('#ex-prompt').textContent = ex.prompt;
  $('#ex-feedback').textContent = '';
  $('#ex-feedback').className = 'ex-feedback';
  $('#ex-retry').hidden = true;
  exGoban.setPosition(setupToGrid(ex));
}

async function onExerciseClick(x, y) {
  if (!lessonModule || exSolved) return;
  const ex = lessonModule.exercises[exIndex];
  const r = await api('POST', `/api/modules/${lessonModule.id}/attempt`, { exerciseId: ex.id, x, y });
  if (!r.ok) return;
  const fb = $('#ex-feedback');
  if (r.json.correct) {
    exSolved = true;
    fb.textContent = r.json.feedback;
    fb.className = 'ex-feedback ok';
    // mostra la pietra posata
    const grid = setupToGrid(ex); grid[y][x] = ex.toMove === 'B' ? 1 : 2; exGoban.setPosition(grid);
    setTimeout(() => advanceExercise(r.json.moduleCompleted), 1100);
  } else {
    fb.textContent = r.json.feedback;
    fb.className = 'ex-feedback no';
    $('#ex-retry').hidden = false;
  }
}

function advanceExercise(moduleCompleted) {
  if (exIndex + 1 < lessonModule.exercises.length) { showExercise(exIndex + 1); return; }
  const fb = $('#ex-feedback');
  fb.textContent = moduleCompleted ? '🎉 Modulo completato!' : 'Esercizi completati.';
  fb.className = 'ex-feedback ok';
  setTimeout(loadModules, 1200); // torna ai moduli (stato aggiornato)
}

// Costruisce la matrice [size][size] dal setup dell'esercizio.
function setupToGrid(ex) {
  const grid = Array.from({ length: ex.size }, () => Array(ex.size).fill(0));
  for (const s of ex.setup) grid[s.y][s.x] = s.color === 'B' ? 1 : 2;
  return grid;
}

function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// markdown leggerissimo: **grassetto** e *corsivo*
function mdLite(s) {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
}

// Service worker (PWA)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
