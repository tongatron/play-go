# Implementation Plan: play-go MVP

**Branch**: `001-go-mvp` | **Date**: 2026-06-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-go-mvp/spec.md`

## Summary

App web per imparare e giocare a Go, self-hosted su Raspberry Pi 3 ed esposta su
`go.tongatron.org`. MVP con tre slice: gioco contro il computer (GNU Go) su 9×9/13×13
con scoring ad area, percorso didattico con memoria dei moduli, e partite asincrone tra
utenti. Approccio tecnico: monolite **Node.js 20 + Express**, **SQLite** per la
persistenza, motore di regole in modulo puro testabile, frontend **PWA mobile-first**
con goban in Canvas/SVG, avversario via **GNU Go (GTP) on-demand**. Deploy come service
systemd dietro tunnel Cloudflare, secondo i pattern di `raspi3.md`.

## Technical Context

**Language/Version**: Node.js 20 (v20.19.2 confermato sul Pi3), JavaScript ES modules

**Primary Dependencies**: Express; `better-sqlite3` (SQLite sincrono, leggero, nativo
armv7l); `argon2` o `bcrypt` per hashing; `cookie-session`/cookie firmato per sessioni;
GNU Go 3.8 (binario di sistema via `apt`, pilotato in GTP su stdin/stdout). Frontend
vanilla + Canvas/SVG, nessun framework SPA pesante.

**Storage**: SQLite (file unico in `data/play-go.db`), accesso via `better-sqlite3`.

**Testing**: `node:test` (runner integrato, zero dipendenze) per il motore di regole,
validazione mosse e import/export SGF.

**Target Platform**: Raspbian trixie armv7l su Raspberry Pi 3; client browser moderni
(desktop + mobile).

**Project Type**: Web application monolitica (server Express che serve sia API sia
frontend statico).

**Performance Goals**: risposta GNU Go su 9×9 ≤ ~5 s a difficoltà media; UI fluida su
mobile.

**Constraints**: **~389 MB RAM liberi** sul Pi3 (verificato) e under-voltage noto →
footprint minimo obbligatorio; ≤ 3 partite vs computer simultanee; nessun processo AI
residente; una istanza GNU Go per partita attiva, terminata a fine mossa/partita.

**Scale/Scope**: utenza ridotta (uso personale/amici), decine di utenti, non concorrenza
di massa.

## Constitution Check

*GATE: superato prima della Fase 0 e ri-verificato dopo la Fase 1.*

| Principio | Verifica | Esito |
|---|---|---|
| I. Footprint minimo | SQLite (no DB server), GNU Go on-demand (no AI residente), no SPA pesante, `better-sqlite3` nativo | ✅ |
| II. Coerenza raspi | Node20+Express, systemd, `/srv/apps/play-go`, porta 3504, tunnel Cloudflare, `.env`, analytics.js | ✅ |
| III. Correttezza regole | Motore puro con cattura/ko/superko/suicidio/area-scoring, isolato da rete/UI | ✅ |
| IV. Test logica critica | `node:test` su motore, validazione mosse, SGF | ✅ |
| V. Privacy/identità | nome+password, hash argon2/bcrypt, nessuna email, avviso no-recovery | ✅ |

Nessuna violazione → Complexity Tracking non necessario.

## Project Structure

### Documentation (this feature)

```text
specs/001-go-mvp/
├── plan.md              # Questo file
├── research.md          # Fase 0 — decisioni tecniche e ricognizione Pi3
├── data-model.md        # Fase 1 — schema entità/SQLite
├── quickstart.md        # Fase 1 — setup locale e deploy sul Pi3
└── contracts/
    └── api.md           # Fase 1 — contratti HTTP/WS
```

### Source Code (repository root)

```text
src/
├── server.js                 # bootstrap Express, sessione, static, rotte
├── db/
│   ├── index.js              # connessione better-sqlite3 + migrazioni
│   └── migrations/           # schema SQL versionato
├── go/                       # MOTORE PURO (no rete, no UI) — Principio III
│   ├── board.js              # stato goban, libertà, cattura, suicidio
│   ├── ko.js                 # ko / superko posizionale (hash posizioni)
│   ├── score.js              # scoring ad area (cinese) + komi
│   └── sgf.js                # import/export SGF, replay
├── ai/
│   └── gnugo.js              # spawn GNU Go in GTP, gen_move, livelli, timeout
├── routes/
│   ├── auth.js               # registrazione, login, logout, sessione
│   ├── games.js              # partite vs computer (crea, mossa, pass, resign, score)
│   ├── pvp.js                # sfide + partite async, turni, notifiche
│   └── learn.js              # moduli, esercizi, progressi
├── content/
│   └── modules/              # moduli didattici come dati (JSON/SGF + testo IT)
└── public/                   # PWA: html, css, js, goban Canvas/SVG, manifest, sw

tests/
├── unit/                     # board, ko, score, sgf
└── integration/              # validazione mosse via API, flussi auth/turni

deploy/
├── play-go.service          # unit systemd (esempio)
└── .env.example             # COOKIE_SECRET, PORT=3504, HOST=127.0.0.1
```

**Structure Decision**: monolite a progetto singolo. Il **motore di regole `src/go/`**
è deliberatamente separato e puro: non importa Express né tocca il DB, così è
testabile in isolamento (Principio III/IV) e riutilizzabile da gioco-vs-computer,
multiplayer e validazione esercizi didattici. GNU Go è incapsulato in `src/ai/gnugo.js`
dietro un'interfaccia minima (`genMove(position, level)`), così un eventuale cambio di
motore non tocca il resto.

## Fasi successive

- **Fase 0** → `research.md` (decisioni risolte, incl. ricognizione Pi3).
- **Fase 1** → `data-model.md`, `contracts/api.md`, `quickstart.md`.
- **Fase 2** → `/tasks` genera `tasks.md` (NON prodotto da questo plan).

## Complexity Tracking

Nessuna violazione della constitution: sezione non applicabile.
