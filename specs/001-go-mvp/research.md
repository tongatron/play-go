# Research (Fase 0) — play-go MVP

Ricognizione e decisioni tecniche a supporto di [plan.md](plan.md). Le verifiche sul
Pi3 sono state eseguite via SSH in sola lettura (2026-06-29).

## Ricognizione Raspberry Pi 3 (verificata)

| Voce | Valore | Implicazione |
|---|---|---|
| Arch / OS | armv7l, Raspbian trixie | binari/pacchetti armhf |
| RAM | 921 MB tot, **~389 MB liberi** | footprint minimo non negoziabile |
| Node | v20.19.2 | nessun transpiler necessario |
| GNU Go | apt **3.8-13**, non installato | `apt install gnugo` in fase di deploy |
| Porta 3504 | libera | bind app sul Pi |
| Under-voltage | `throttled=0x50000` (storico) | evitare picchi CPU prolungati |

## Decisioni

### D1 — Avversario AI: GNU Go 3.8 via GTP
**Scelta**: pacchetto di sistema `gnugo`, pilotato in **GTP** (Go Text Protocol) su
stdin/stdout da `src/ai/gnugo.js`. Mosse via `genmove`, livelli con `--level N`.
**Razionale**: leggerissimo (pochi MB), gira nativamente su armv7l, deterministico,
nessuna RAM residente. **Alternative scartate**: KataGo/Leela (RAM/CPU insostenibili
con 389 MB liberi); MCTS fatto in casa (più lavoro, più debole) tenuto come fallback
teorico. **Rischio/mitigazione**: spawn on-demand, **un processo per partita**, kill a
fine mossa o su timeout; cap di 3 partite vs computer simultanee (SC-006).

### D2 — Persistenza: SQLite via `better-sqlite3`
**Scelta**: file unico `data/play-go.db`. **Razionale**: zero servizi extra (Principio
I), API sincrona semplice, ottime performance su singolo nodo; coerente con l'approccio
file-based delle altre app raspi ma con query relazionali per partite/progressi.
**Alternative scartate**: `db.json` (no query/concorrenza), Postgres/MySQL (overhead RAM).
**Nota armv7l**: `better-sqlite3` è nativo; verificare il build su Pi (`npm ci`),
eventuale fallback `node:sqlite` (sperimentale in Node 20) o `sql.js`.

### D3 — Regole: scoring ad area (cinese)
**Scelta**: conteggio **area** (pietre + territorio circondato) con komi configurabile.
**Razionale**: più automatizzabile del territorio giapponese; non richiede contare le
catture. Fine partita: doppio pass → fase di marcatura **pietre morte concordata** dai
due giocatori → calcolo. **Alternative scartate**: regole giapponesi (dead-stone e
seki più complessi). **Nota**: niente rilevamento automatico pietre morte nell'MVP.

### D4 — Ko / superko
**Scelta**: vietare la ricreazione di una posizione già occorsa, tramite **hash della
posizione** (board+turno) mantenuto nella history della partita (superko posizionale).
**Razionale**: copre sia il ko semplice sia ripetizioni più lunghe con una sola regola.

### D5 — SGF come formato partite
**Scelta**: import/export **SGF** standard per salvataggio, replay e contenuti
didattici (i tsumego possono essere definiti come SGF + soluzione). **Razionale**:
formato universale del Go, abilita interoperabilità e riuso dei problemi.

### D6 — Multiplayer asincrono
**Scelta**: partite **a turni** persistite su DB; lo stato "di chi è il turno" è
autoritativo lato server. WebSocket **solo per notifiche/refresh**, non come canale
real-time obbligatorio (polling come fallback). Timeout abbandono **14 giorni**.
**Razionale**: robusto su hardware casalingo e disconnessioni; nessuna sessione
real-time da tenere viva.

### D7 — Auth nome+password
**Scelta**: hash **argon2id** (fallback `bcrypt` se il build argon2 su armv7l dà
problemi), sessione via cookie firmato (`COOKIE_SECRET` in `.env`). Avviso esplicito in
registrazione: **niente email = niente recupero password**. Username univoco, validato
(lunghezza/caratteri).

### D8 — Frontend PWA vanilla
**Scelta**: HTML/CSS/JS vanilla, goban in **Canvas** (rendering) con manifest +
service worker (coerente con pillo/memo). **Razionale**: nessun bundle pesante da
servire/buildare; mobile-first. Include `https://tongatron.org/analytics.js`.

### D9 — Contenuti didattici come dati
**Scelta**: moduli in `src/content/modules/` come file dati (JSON con testo IT + SGF
per board/esercizi). Prerequisiti dichiarati nel file del modulo. **Razionale**:
nessun editor/CMS nell'MVP; i contenuti (bozza da revisionare) sono versionati con il
codice.

## Questioni aperte residue (non bloccanti per il plan)
- Conferma build di `better-sqlite3` e `argon2` su armv7l in fase di deploy (D2, D7).
- Set esatto e ordine dei primi moduli didattici (bozza in fase di implementazione).
