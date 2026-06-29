---
description: "Task list per l'implementazione di play-go MVP"
---

# Tasks: play-go MVP — imparare e giocare a Go

**Input**: Design da `specs/001-go-mvp/` (spec.md, plan.md, research.md, data-model.md, contracts/api.md)

**Tests**: INCLUSI per la logica critica — richiesto dalla Constitution (Principio IV:
motore regole, validazione mosse, SGF). UI e contenuti didattici non richiedono lo
stesso rigore.

**Organizzazione**: i task sono raggruppati per user story, così ogni story è
implementabile, testabile e rilasciabile in modo indipendente (P1 → P2 → P3).

## Format: `[ID] [P?] [Story] Descrizione`

- **[P]**: eseguibile in parallelo (file diversi, nessuna dipendenza)
- **[Story]**: US1 (vs computer), US2 (didattica), US3 (multiplayer async)

---

## Phase 1: Setup (infrastruttura condivisa)

- [ ] T001 Inizializzare progetto Node 20 ESM: `package.json` (scripts `dev`/`start`/`test`), struttura cartelle di `plan.md` (`src/`, `tests/`, `deploy/`, `src/public/`)
- [ ] T002 [P] Aggiungere dipendenze: `express`, `better-sqlite3`, `argon2` (fallback `bcrypt`), libreria cookie di sessione firmata
- [ ] T003 [P] Configurare lint/format (es. `eslint` + `prettier`) e `.editorconfig`
- [ ] T004 [P] Creare `deploy/.env.example` (`COOKIE_SECRET`, `PORT=3504`, `HOST=127.0.0.1`) e `deploy/play-go.service` (unit systemd)

---

## Phase 2: Foundational (prerequisiti bloccanti)

**⚠️ Nessuna user story può iniziare prima del completamento di questa fase.**

- [ ] T005 Bootstrap server Express in `src/server.js`: middleware base, static da `src/public/`, error handler `{error,message}`, healthcheck `/health`
- [ ] T006 Connessione SQLite + framework migrazioni in `src/db/index.js`; prima migrazione schema (`user`, `game`, `challenge`, `module_progress`) in `src/db/migrations/` secondo `data-model.md`
- [ ] T007 [P] Sessione + cookie firmato e middleware `requireAuth` (rotte 🔒) — coerente con `COOKIE_SECRET`
- [ ] T008 [P] PWA shell in `src/public/`: layout mobile-first, manifest, service worker, inclusione `https://tongatron.org/analytics.js`
- [ ] T009 [P] Componente goban riusabile (Canvas) in `src/public/` per render board + input mossa (usato da gioco e didattica)

**Checkpoint**: fondazione pronta — le user story possono iniziare.

---

## Phase 3: User Story 1 — Registrazione + gioco vs computer (P1) 🎯 MVP

**Goal**: un utente si registra, gioca una partita 9×9/13×13 contro GNU Go, arriva a
conteggio (area) o resa, salva e rivede la partita.

**Independent Test**: registrarsi, giocare una partita 9×9 contro il computer fino al
doppio pass, verificare conteggio area corretto e replay.

### Tests US1 (scrivere PRIMA, devono FALLIRE)
- [ ] T010 [P] [US1] Unit test motore in `tests/unit/board.test.js`: posa, libertà, cattura, suicidio vietato
- [ ] T011 [P] [US1] Unit test in `tests/unit/ko.test.js`: ko semplice e superko posizionale (ripetizione)
- [ ] T012 [P] [US1] Unit test in `tests/unit/score.test.js`: scoring ad area + komi su posizioni note
- [ ] T013 [P] [US1] Unit test in `tests/unit/sgf.test.js`: export → import → replay round-trip
- [ ] T014 [P] [US1] Integration test in `tests/integration/play.test.js`: register → crea partita → mossa illegale rifiutata (`422` con `reason`) → partita legale

### Motore di gioco (puro — `src/go/`)
- [ ] T015 [P] [US1] `src/go/board.js`: stato goban, gruppi/libertà, cattura, divieto suicidio
- [ ] T016 [P] [US1] `src/go/ko.js`: hash posizione + regola superko posizionale
- [ ] T017 [US1] `src/go/score.js`: conteggio area (cinese) + komi, fase pietre morte (input punti)
- [ ] T018 [P] [US1] `src/go/sgf.js`: import/export SGF + ricostruzione posizione per replay

### Auth
- [ ] T019 [US1] `src/routes/auth.js`: `POST /api/auth/register` (username univoco, hash argon2, avviso no-recovery), `login`, `logout`, `GET /me` — secondo `contracts/api.md`

### Avversario AI
- [ ] T020 [US1] `src/ai/gnugo.js`: spawn GNU Go in GTP, `genMove(position, level)`, mappa livelli difficoltà, timeout + kill processo, errore gestito (`503`)

### API partita vs computer
- [ ] T021 [US1] `src/routes/games.js`: `POST /api/games` (vs_computer), `GET /api/games/:id`, persistenza SGF su `game`
- [ ] T022 [US1] `src/routes/games.js`: `POST .../move` (valida con `src/go/`, poi mossa GNU Go in `aiMove`), `.../pass` (doppio pass → `scoring`), `.../resign`
- [ ] T023 [US1] `src/routes/games.js`: `POST .../dead-stones` + `.../score-accept` (conferma reciproca → `result`), `GET .../sgf`
- [ ] T024 [US1] Frontend `src/public/play`: pagina partita vs computer (selezione board/difficoltà, goban, pass/resign, schermata risultato, replay)

**Checkpoint**: US1 completa e testabile da sola → **MVP demo-abile**.

---

## Phase 4: User Story 2 — Percorso didattico con memoria moduli (P2)

**Goal**: l'utente segue moduli (lezione + esercizi tsumego), il sistema valida le
risposte col motore, segna i completamenti e sblocca i moduli successivi.

**Independent Test**: completare il primo modulo, verificare "completato" dopo
logout/login e lo sblocco del successivo.

### Tests US2
- [ ] T025 [P] [US2] Integration test in `tests/integration/learn.test.js`: attempt corretto → modulo completato e persistito; attempt errato → non completato; prerequisiti sbloccano il successivo

### Implementazione US2
- [ ] T026 [P] [US2] Formato modulo + loader in `src/content/modules/` (JSON: titolo IT, order, prerequisites, lesson, exercises come SGF + soluzione)
- [ ] T027 [P] [US2] Bozza contenuti iniziali (IT) in `src/content/modules/`: regole base, cattura, occhi/vita-morte, ko, territorio (da revisionare)
- [ ] T028 [US2] `src/routes/learn.js`: `GET /api/modules` (con `unlocked`/`completed` per utente), `GET /api/modules/:id`, `POST .../attempt` (valida sequenza col motore `src/go/`)
- [ ] T029 [US2] Persistenza progressi: scritture su `module_progress`; logica sblocco da prerequisiti
- [ ] T030 [US2] Frontend `src/public/learn`: elenco moduli (stato), vista lezione, esercizio interattivo su goban con feedback e ritentativo

**Checkpoint**: US1 + US2 funzionanti indipendentemente.

---

## Phase 5: User Story 3 — Partita asincrona vs altro utente (P3)

**Goal**: due utenti giocano a turni; sfide create/accettate, turni autoritativi lato
server, notifiche, conteggio o resa; abbandono dopo 14 giorni.

**Independent Test**: con due account, creare/accettare una sfida, alternare mosse
rispettando i turni, concludere e vedere il risultato per entrambi.

### Tests US3
- [ ] T031 [P] [US3] Integration test in `tests/integration/pvp.test.js`: crea sfida → accetta → mossa fuori turno rifiutata (`409`) → turni alternati → resign/risultato

### Implementazione US3
- [ ] T032 [P] [US3] `src/routes/pvp.js`: `GET/POST /api/challenges`, `POST .../accept` (crea `game` async), `DELETE` (solo creatore)
- [ ] T033 [US3] Estendere `src/routes/games.js`: mosse async riusano `move/pass/resign`, enforce turno (`409` se non è il tuo turno), aggiornare `turn`/`updated_at`
- [ ] T034 [US3] `GET /api/games?mine=1` + WebSocket `/ws` per notifica "è il tuo turno" (polling come fallback)
- [ ] T035 [US3] Job/timeout: partita async → `abandoned` dopo 14 giorni di inattività del giocatore di turno
- [ ] T036 [US3] Frontend `src/public/games`: lista sfide + mie partite (badge turno), vista partita async, notifiche

**Checkpoint**: tutte e tre le user story indipendentemente funzionanti.

---

## Phase 6: Polish & deploy

- [ ] T037 [P] Verifica carico Pi3: 3 partite vs computer simultanee senza crash/OOM (SC-006), tempo mossa 9×9 ≤ ~5s (SC-003)
- [ ] T038 [P] Hardening: rate-limit su register/login, validazione input, headers sicurezza
- [ ] T039 Validare `quickstart.md` su Pi3: `apt install gnugo`, `npm ci` (conferma build `better-sqlite3`/`argon2` armv7l), service systemd, tunnel `go.tongatron.org`
- [ ] T040 Aggiornare `raspi3.md`: porta 3504, `play-go.service`, hostname, percorso `/srv/apps/play-go`
- [ ] T041 [P] README con setup, architettura e link agli artefatti spec

---

## Dipendenze & ordine di esecuzione

### Fasi
- **Setup (P1)**: nessuna dipendenza.
- **Foundational (P2)**: dipende dal Setup — **blocca tutte le user story**.
- **User Stories (P3→P5)**: dipendono dalla Foundational; poi in ordine di priorità
  (o in parallelo se ci fossero più sviluppatori). US2 e US3 riusano il motore di US1.
- **Polish (P6)**: dopo le user story desiderate.

### Dentro ogni user story
- I **test** vanno scritti prima e devono fallire.
- Motore puro (`src/go/`) prima delle rotte; rotte prima del frontend.

### Parallelizzabili [P]
- T010–T014 (test US1) insieme; T015/T016/T018 (moduli motore su file diversi) insieme.
- Setup T002/T003/T004 insieme; Foundational T007/T008/T009 insieme.

---

## Strategia di implementazione

**MVP prima**: Setup → Foundational → US1 → **STOP e valida** (partita vs computer
end-to-end) → demo. Poi US2, poi US3, ciascuna testata in isolamento prima di
proseguire. Commit dopo ogni task o gruppo logico.

## Note
- `src/go/` resta puro: nessun `import` di express/db/gnugo. È il cuore della
  correttezza (Constitution III) e va tenuto isolato.
- Una istanza GNU Go per partita, killata a fine mossa (Constitution I).
- Verificare i test rossi prima di implementare.
