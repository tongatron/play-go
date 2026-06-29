# play-go Constitution

Sito per imparare e giocare a Go (Weiqi/Baduk), self-hosted sul Raspberry Pi 3
dell'infrastruttura `tongatron.org` ed esposto come `go.tongatron.org`.

## Core Principles

### I. Footprint minimo (NON-NEGOZIABILE)

L'app gira su un **Raspberry Pi 3 (armv7l, 1 GB RAM)** che presenta
under-voltage/throttling documentato (`raspi3.md`). Ogni decisione tecnica deve
minimizzare RAM, CPU e dipendenze:

- Nessun database server separato: si usa **SQLite** (file unico).
- Nessun motore Go neurale pesante: l'avversario computer è **GNU Go** (classico,
  via protocollo GTP), invocato on-demand e non residente.
- Niente build-step pesanti né framework SPA voluminosi lato client.
- Le partite contro il computer non devono saturare la CPU: tempo di mossa
  limitato, una sola istanza GNU Go alla volta per processo se necessario.

### II. Coerenza con l'ecosistema raspi

Il progetto deve integrarsi con i pattern già in uso sul Pi3 (vedi `raspi3.md`):

- **Stack Node.js 20 + Express**, avvio come **service systemd**, working dir
  `/srv/apps/play-go`, bind su `127.0.0.1` + porta dedicata (prossima libera, es.
  3504), reverse proxy/tunnel **Cloudflare** verso `go.tongatron.org`.
- Segreti in `.env` (mai committati): almeno `COOKIE_SECRET`, `PORT`, `HOST`.
- Le pagine includono `https://tongatron.org/analytics.js` (GA4 + Consent Mode v2).
- Deploy via **git pull + `systemctl restart`** dal repo GitHub `tongatron/play-go`.
- `raspi3.md` va aggiornato quando l'app entra in produzione (porta, service, tunnel).

### III. Correttezza delle regole del Go

Il motore di gioco è il cuore del prodotto e deve essere **dimostrabilmente
corretto**, non "abbastanza giusto":

- Gestione esplicita di: cattura, libertà, **suicidio** vietato, **ko**
  (e superko posizionale), **pass**, **resign**.
- **Scoring ad area (regole cinesi)** con komi configurabile; fine partita con
  marcatura/rimozione **pietre morte confermata da entrambi i giocatori**.
- Logica di gioco isolata in un modulo puro, **testabile senza rete né UI**.

### IV. Test sulla logica critica

Test automatici obbligatori per: motore regole (cattura/ko/suicidio/scoring),
validazione mosse lato server, e import/export **SGF**. La UI e i contenuti
didattici non richiedono lo stesso rigore. I test della logica di gioco vanno
scritti prima o insieme all'implementazione, mai dopo il merge.

### V. Privacy e semplicità dell'identità

Registrazione con **solo nome utente + password**. Vincoli che ne derivano e che
sono accettati esplicitamente:

- Password con hash forte (**argon2** o bcrypt); mai in chiaro né nei log.
- **Nessuna email ⇒ nessun recupero password**: limite dichiarato all'utente in
  fase di registrazione.
- Dati personali minimi; nessun tracciamento oltre l'analytics aggregato esistente.

## Vincoli tecnici e di scope

- **Stack**: Node.js 20, Express, SQLite, frontend PWA mobile-first (Canvas/SVG per
  la goban). Lingua dei contenuti e della UI: **italiano**.
- **Avversario AI**: GNU Go via GTP, con livelli di difficoltà ottenuti limitando
  la profondità/tempo di ricerca.
- **Multiplayer**: modalità **correspondence/async** (partite a turni); WebSocket
  solo per notifiche/aggiornamenti, non come canale real-time obbligatorio.
- **Board MVP**: **9×9 e 13×13**. Il 19×19 è esplicitamente fuori dall'MVP.
- **Didattica**: moduli (lezioni + esercizi tsumego interattivi) con prerequisiti;
  il sistema traccia per ogni utente i moduli completati. I contenuti iniziali sono
  bozze in italiano da revisionare.
- **Fuori scope MVP**: 19×19, multiplayer real-time con time control, ranking/ELO,
  recupero password, motori neurali (KataGo/Leela).

## Workflow di sviluppo (Spec-Driven)

Si segue il flusso Spec-Kit: `constitution` → `specify` → `clarify` → `plan` →
`tasks` → `implement`. Ogni feature vive in `specs/[NNN-nome]/`. Le user story sono
prioritizzate (P1/P2/P3) e ciascuna è una **slice indipendente e testabile** che da
sola costituisce un MVP utilizzabile. Nessuna implementazione inizia prima che la
relativa spec sia priva di marcatori `[NEEDS CLARIFICATION]` sui punti bloccanti.

## Governance

Questa constitution prevale sulle preferenze estemporanee. Ogni complessità
aggiunta (nuova dipendenza, servizio, processo residente) deve essere giustificata
contro il Principio I (Footprint minimo). Emendamenti: documentati in questo file
con bump di versione e data. Le scelte di prodotto già fissate (GNU Go, async, 9×9 +
13×13, scoring cinese, italiano) si cambiano solo aggiornando qui prima del codice.

**Version**: 1.0.0 | **Ratified**: 2026-06-29 | **Last Amended**: 2026-06-29
