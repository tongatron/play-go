# API Contracts (Fase 1) — play-go MVP

Contratti HTTP del server Express. Tutte le risposte JSON salvo le pagine/asset statici.
Autenticazione via cookie di sessione firmato; le rotte marcate 🔒 richiedono login.

## Auth

| Metodo | Path | Body | Risposta | Note |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{username, password}` | `201 {user}` / `409` se esiste | mostra avviso no-recovery lato UI |
| POST | `/api/auth/login` | `{username, password}` | `200 {user}` / `401` | imposta cookie |
| POST | `/api/auth/logout` | — | `204` | invalida sessione |
| GET | `/api/auth/me` 🔒 | — | `200 {user}` | utente corrente |

## Gioco vs computer

| Metodo | Path | Body | Risposta |
|---|---|---|---|
| POST | `/api/games` 🔒 | `{type:"vs_computer", board_size, komi, ai_level, color}` | `201 {game}` |
| GET | `/api/games/:id` 🔒 | — | `200 {game, position, legalMoves?, turn, status}` |
| POST | `/api/games/:id/move` 🔒 | `{point}` | `200 {game, position, aiMove?}` / `422` se illegale (con motivo) |
| POST | `/api/games/:id/pass` 🔒 | — | `200 {game, status}` (doppio pass → `scoring`) |
| POST | `/api/games/:id/resign` 🔒 | — | `200 {game, result}` |
| POST | `/api/games/:id/dead-stones` 🔒 | `{points[]}` | `200` marca pietre morte (richiede conferma reciproca) |
| POST | `/api/games/:id/score-accept` 🔒 | — | `200 {result}` quando entrambi confermano |
| GET | `/api/games/:id/sgf` 🔒 | — | `200` SGF (replay/export) |

> Su `vs_computer`, dopo la mossa dell'utente il server genera la risposta GNU Go
> (`src/ai/gnugo.js`) entro il timeout e la restituisce in `aiMove`. Errore motore →
> `503` gestito, partita non corrotta.

## Multiplayer asincrono

| Metodo | Path | Body | Risposta |
|---|---|---|---|
| GET | `/api/challenges` 🔒 | — | `200 {challenges[]}` (aperte) |
| POST | `/api/challenges` 🔒 | `{board_size, komi, creator_color}` | `201 {challenge}` |
| POST | `/api/challenges/:id/accept` 🔒 | — | `201 {game}` |
| DELETE | `/api/challenges/:id` 🔒 | — | `204` (solo creatore) |
| GET | `/api/games?mine=1` 🔒 | — | `200 {games[]}` (le mie partite, con `turn`) |
| WS | `/ws` 🔒 | — | notifiche "è il tuo turno"/aggiornamento; polling come fallback |

> Le mosse async usano gli stessi endpoint `/api/games/:id/{move,pass,resign}`; il
> server rifiuta (`409`) le mosse fuori turno.

## Didattica

| Metodo | Path | Body | Risposta |
|---|---|---|---|
| GET | `/api/modules` 🔒 | — | `200 {modules[]}` con `unlocked` e `completed` per utente |
| GET | `/api/modules/:id` 🔒 | — | `200 {lesson, exercises}` (se sbloccato) |
| POST | `/api/modules/:id/attempt` 🔒 | `{exerciseId, moves[]}` | `200 {correct, feedback}`; se tutti corretti marca completato |

## Pagine / statici
- `GET /` landing, `/play`, `/learn`, `/games`, `/login` — servite come PWA da
  `src/public/` (manifest + service worker). Tutte includono `analytics.js`.

## Convenzioni errori
`4xx/5xx` con `{error, message}`. `422` per mossa illegale include `reason`
(`suicide` | `ko` | `occupied` | `not_your_turn` | `out_of_bounds`).
