# Raspberry Pi 3 — Inventory

Snapshot: 2026-06-18
Host: `raspberrypi` — IP: `192.168.1.210` — MAC: `b8:27:eb:05:fc:ee`
OS: Raspbian GNU/Linux 13 (trixie) — armv7l — kernel 6.12.75+rpt-rpi-v7
Node.js: v20.19.2 / npm 9.2.0
Tailscale IP: `100.125.208.128`

Questo file documenta i servizi, le app e la topologia di rete del Raspberry Pi 3.
Va aggiornato ogni volta che si aggiunge un servizio, cambia una porta, o si modifica un tunnel.

---

## Accesso SSH

User: `giovanni` — key: `~/.ssh/raspberry_pi` (Mac).

```bash
# Rete locale (preferito)
ssh -i ~/.ssh/raspberry_pi giovanni@raspberrypi.local

# Fallback Tailscale (fuori rete locale)
ssh -i ~/.ssh/raspberry_pi giovanni@raspberrypi.tailce2514.ts.net
```

Già configurato in `~/.ssh/config` sul Mac come `Host raspberrypi` (o simile).

---

## Topologia pubblica (Cloudflare Tunnels)

### Tunnel principale (`cloudflared.service`)

Config: `/etc/cloudflared/config.yml` — Tunnel ID: `8521f89c-9038-474b-886b-71fb4ae98bc6`

| Hostname | → Porta locale | Servizio |
|---|---|---|
| `tamagiochi.tongatron.org` | `localhost:3002` | Tamagiochi |
| `chat.tongatron.org` | `localhost:80` (nginx) | raspi-chat |
| `api.tongatron.org` | `localhost:80` (nginx) | raspi-chat API |
| `private.tongatron.org` | `localhost:3200` | raspi-admin |
| `library.tongatron.org` | `localhost:3201` | liberia |
| `alcol-monitor-old.tongatron.org` | `127.0.0.1:3400` | alcol-monitor (vecchio) |
| `magazzino.tongatron.org` | `127.0.0.1:3100` | magazzino-sereno |
| `indovinachi.tongatron.org` | `127.0.0.1:3010` | indovina-chi |
| `github.tongatron.org` | `127.0.0.1:3010` | indovina-chi (alias) |
| `jobseeker.tongatron.org` | `127.0.0.1:3501` | jobseeker |
| `hre.tongatron.org` | `127.0.0.1:3500` | HRE |
| `pillo.tongatron.org` | `localhost:3502` | pillo |
| `memo.tongatron.org` | `127.0.0.1:3503` | memo |

### Tunnel magazzino (`cloudflared-magazzino.service`)

Config: `~/.cloudflared/magazzino-config.yml` — Tunnel ID: `e1fea28b-808a-40d5-a5cc-3b8adce1c71e`

---

## Porte in ascolto

| Porta | Bind | Processo / Service | Servizio |
|---|---|---|---|
| `22` | `0.0.0.0` | `sshd` | accesso shell |
| `80` | `0.0.0.0` | `nginx` | reverse proxy |
| `139`, `445` | `0.0.0.0` | `smbd` | Samba |
| `3000` | `127.0.0.1` | `raspi-chat.service` | raspi-chat (chat + mail API) |
| `3001` | `127.0.0.1` | `tongatron-server.service` | tongatron-server (mail Express legacy) |
| `3002` | `*` | `pm2-giovanni.service` (Tamagiochi) | Tamagiochi |
| `3010` | `0.0.0.0` | `indovina-chi.service` | indovina-chi |
| `3100` | `127.0.0.1` | `magazzino.service` | magazzino-sereno |
| `3200` | `127.0.0.1` | `raspi-admin.service` | pannello admin |
| `3201` | `127.0.0.1` | `liberia.service` | liberia (ISBN scanner) |
| `3300` | `0.0.0.0` | `my-scarpings.service` | monitor cambi sito |
| `3400` | `127.0.0.1` | `alcol-monitor.service` | alcol-monitor (vecchio) |
| `3500` | `127.0.0.1` | `hre.service` | HRE log giornaliero |
| `3501` | `127.0.0.1` | `jobseeker.service` | jobseeker |
| `3502` | `127.0.0.1` | `pillo.service` | pillo |
| `3503` | `127.0.0.1` | `memo.service` | memo |

---

## App e servizi

### raspi-chat

- **Service:** `raspi-chat.service`
- **Working dir:** `/srv/apps/raspi-chat`
- **Git:** `https://github.com/tongatron/raspi-chat.git`
- **Avvio:** `/usr/bin/node /srv/apps/raspi-chat/server.js`
- **Bind:** `127.0.0.1:3000`
- **Env:** `HOST=127.0.0.1`, `PORT=3000`
- **Hostname pubblici:** `chat.tongatron.org`, `api.tongatron.org` (via nginx)

Route principali: `/` landing, `POST /api/send-mail`, `/chat*`, `/ws` (WebSocket), `/health`, `/status`

---

### raspi-admin

- **Service:** `raspi-admin.service`
- **Working dir:** `/srv/apps/raspi-admin`
- **Git:** `https://github.com/tongatron/raspi-admin.git` (privato)
- **Avvio:** `/usr/bin/node server.js`
- **Bind:** `127.0.0.1:3200`
- **Env file:** `/srv/apps/raspi-admin/.env`
- **Hostname pubblico:** `https://private.tongatron.org`
- **Login:** `https://private.tongatron.org/admin/login`

Pannello admin: gestione servizi systemd, log, repo GitHub. Protetto da `ADMIN_PASSWORD` in `.env`.

### raspi-admin Telegram bot

- **Service:** `raspi-admin-telegram-bot.service`
- **Working dir:** `/srv/apps/raspi-admin`
- **Avvio:** `/usr/bin/node telegram-bot.js`
- **Env file:** `/srv/apps/raspi-admin/.env`

Bot Telegram (`@macostongatronbot`) per notifiche e controllo remoto via chat.

**Alert automatici** (loop di monitoraggio ogni ~120s su Pi3 + nodi remoti):
- **Temperatura** ≥ soglia `TEMP_ALERT_C` (default 75°C) e rientro sotto soglia.
- **Host giù / online**: host remoto non raggiungibile via SSH per `DOWN_ALERT_MISSES` controlli consecutivi (default 2) → "host giù"; al recupero → "host online". Il nodo locale non si auto-monitora.

Lo stesso bot è usato (stesso token) anche da: **jobseeker** (annunci), **tongatron-server** (mail dal form contatti), **my-scarpings** (cambi sito), **memo** (promemoria). La dashboard ha una sezione **Bot Telegram** che mostra stato e descrizione di ciascuna integrazione.

#### Dashboard Stato (fleet)

Il pannello include un tab **"Stato"** (`https://private.tongatron.org/admin`) che mostra lo stato live di tutta l'infrastruttura casalinga.

- **Endpoint:** `GET /admin/api/fleet` (auth richiesta) — definito in `index.js`.
- **Cosa fa:** interroga in parallelo ogni host (locale via `bash`, remoti via SSH con `IdentitiesOnly=yes` + `BatchMode=yes`) raccogliendo: OS, arch, uptime, RAM, disco, temperatura, load, n° servizi running, unità systemd **fallite**, `vcgencmd get_throttled` (under-voltage), reboot pendente e l'ingress dei config Cloudflare (`/etc/cloudflared/config.yml` + `~/.cloudflared/*.yml`). Poi fa un **health-check HTTP** di ogni hostname `*.tongatron.org` (codice + latenza).
- **Host monitorati:** definiti in `REMOTE_NODES` nel `.env` (`nome:user@target,...`). Attuale:
  `hp-ubuntu:giovanni@100.81.62.48,raspi4:giovanni@100.83.195.72` (+ il Pi3 stesso come `pi3` locale).
  HP e raspi4 sono raggiunti via **IP Tailscale** (stabile; l'IP WiFi DHCP no, e il MagicDNS non risolve dal Pi3).
- **Alert host giù:** il bot Telegram avvisa se un host remoto non risponde via SSH (vedi sezione raspi-admin Telegram bot). Il fleet collector mostra anche l'IP Tailscale di ogni host.
- **Refresh:** automatico ogni 30s lato client.
- **Prerequisito:** la chiave del Pi3 (`giovanni@raspberrypi`) dev'essere in `authorized_keys` sugli host remoti (vedi matrice chiavi nel [README](README.md#chiavi-ssh)).

> ⚠️ **Nota throttling:** al 2026-06-18 il Pi3 riporta `throttled=0x50000` → under-voltage **rilevato in passato** (bit 16). L'alimentatore potrebbe essere sottodimensionato; sotto carico può causare instabilità.

> **Codice:** sia il backend (`/admin/api/fleet`) sia la UI del tab "Stato" sono in `index.js` (funzione `dashboardPage()`). Il file `src/pages.js` **non è in uso** dal servizio. Backup degli originali in `index.js.bak.*` sul Pi3.

---

### magazzino-sereno

- **Service:** `magazzino.service`
- **Working dir:** `/home/giovanni/magazzino-sereno/server`
- **Git:** `https://github.com/tongatron/magazzino.git`
- **Avvio:** `/usr/bin/npm start`
- **Bind:** `127.0.0.1:3100`
- **Hostname pubblico:** `https://magazzino.tongatron.org` (tunnel dedicato magazzino)

---

### liberia

- **Service:** `liberia.service`
- **Working dir:** `/home/giovanni/liberia` (o `/srv/apps/liberia`)
- **Bind:** `127.0.0.1:3201`
- **Hostname pubblico:** `https://library.tongatron.org`

Scanner ISBN per catalogare libri.

---

### jobseeker

- **Service:** `jobseeker.service`
- **Working dir:** `/srv/apps/jobseeker/tool`
- **Git:** `https://github.com/tongatron/jobseeker.git` (privato)
- **Avvio:** `uvicorn server:app --host 127.0.0.1 --port 3501`
- **Bind:** `127.0.0.1:3501`
- **Hostname pubblico:** `https://jobseeker.tongatron.org`
- **Auth:** HTTP Basic (password in `tool/data/.password`)

Notifiche giornaliere (lun-ven 08:00) via Telegram e mail per nuovi annunci PiemonteTU.

---

### pillo

- **Service:** `pillo.service`
- **Working dir:** `/srv/apps/pillo`
- **Git:** `https://github.com/tongatron/pillo.git` (privato)
- **Avvio:** `/usr/bin/node /srv/apps/pillo/server.js`
- **Bind:** `127.0.0.1:3502`
- **Env file:** `/srv/apps/pillo/.env` (`COOKIE_SECRET`, `VAPID_*`, `PILLO_USER/PASS`)
- **Hostname pubblico:** `https://pillo.tongatron.org`

PWA tracker terapia farmaci con Web Push (VAPID). Storage in `data/db.json`.

---

### memo

- **Service:** `memo.service`
- **Working dir:** `/srv/apps/memo`
- **Avvio:** `/usr/bin/node /srv/apps/memo/server.js`
- **Bind:** `127.0.0.1:3503`
- **Env:** `NODE_ENV=production`, `PORT=3503`
- **Hostname pubblico:** `https://memo.tongatron.org`

App note & to-do PWA.

---

### HRE

- **Service:** `hre.service`
- **Working dir:** `/srv/apps/hre/06_runtime/app`
- **Avvio:** `/usr/bin/python3 server.py`
- **Bind:** `127.0.0.1:3500`
- **Env:** `PORT=3500`
- **Hostname pubblico:** `https://hre.tongatron.org`

Log giornaliero (Python).

---

### indovina-chi

- **Service:** `indovina-chi.service`
- **Working dir:** `/home/giovanni/indovina-chi`
- **Avvio:** `/usr/bin/env node server.js`
- **Bind:** `0.0.0.0:3010`
- **Env:** `PORT=3010`
- **Hostname pubblici:** `https://indovinachi.tongatron.org`, `https://github.tongatron.org`

Gioco indovina-chi online.

---

### Tamagiochi

- **Gestore:** `pm2-giovanni.service` (PM2)
- **Working dir:** `/home/giovanni/Tamagiochi`
- **Entry:** `server.js`
- **Bind:** `*:3002`
- **Hostname pubblico:** `https://tamagiochi.tongatron.org`

---

### alcol-monitor (vecchio)

- **Service:** `alcol-monitor.service`
- **Working dir:** `/srv/apps/alcol-monitor`
- **Avvio:** `/usr/bin/node /srv/apps/alcol-monitor/server/index.js`
- **Bind:** `127.0.0.1:3400`
- **Hostname pubblico:** `https://alcol-monitor-old.tongatron.org` (deprecato — la versione attiva è sul Server HP)

---

### tongatron-server

- **Service:** `tongatron-server.service` (attivo)
- **Working dir:** `/home/giovanni/tongatron-server`
- **Avvio:** `/usr/bin/node /home/giovanni/tongatron-server/server.js`
- **Bind:** `127.0.0.1:3001`
- **Env file:** `/home/giovanni/tongatron-server/.env`

Server Express con socket.io e nodemailer — predecessore di raspi-chat. Ancora attivo come servizio systemd.

---

### my-scarpings

- **Service:** `my-scarpings.service` (+ `my-scarpings-dashboard.service`)
- **Bind:** `0.0.0.0:3300` (dashboard interna: `127.0.0.1:3001` — condivisa con my-scarpings-dashboard)

Monitor cambi sito, con dashboard interna.

---

## Nginx

Config attiva: `/etc/nginx/sites-enabled/fastify-api`

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    set $upstream http://127.0.0.1:3000;
    if ($host = mhz.tongatron.org) {
        set $upstream http://127.0.0.1:3100;
    }

    location / {
        client_max_body_size 20m;
        proxy_pass $upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## Cloudflare Tunnels — gestione

```bash
# Aggiungere hostname al tunnel principale
cloudflared tunnel route dns 8521f89c-9038-474b-886b-71fb4ae98bc6 <nuovo-hostname>
sudo systemctl restart cloudflared.service
```

---

## Percorsi importanti

| Cosa | Percorso |
|---|---|
| App di produzione | `/srv/apps/` |
| raspi-chat | `/srv/apps/raspi-chat/` |
| raspi-admin | `/srv/apps/raspi-admin/` |
| magazzino-sereno | `/home/giovanni/magazzino-sereno/` |
| indovina-chi | `/home/giovanni/indovina-chi/` |
| Tamagiochi | `/home/giovanni/Tamagiochi/` |
| tongatron-server | `/home/giovanni/tongatron-server/` |
| HRE | `/srv/apps/hre/` |
| memo | `/srv/apps/memo/` |
| Nginx sites | `/etc/nginx/sites-enabled/` |
| Systemd services | `/etc/systemd/system/` |
| Cloudflared config (principale) | `/etc/cloudflared/config.yml` |
| Cloudflared config (magazzino) | `~/.cloudflared/magazzino-config.yml` |
| SSH key (Mac → Pi) | `~/.ssh/raspberry_pi` |
| Backup scripts | `~/backup-raspberry/` |

---

## Comandi utili

```bash
# Stato tutti i servizi custom
systemctl status raspi-chat raspi-admin magazzino nginx cloudflared pillo jobseeker liberia alcol-monitor memo hre indovina-chi

# Log in tempo reale
journalctl -u raspi-admin -f
journalctl -u raspi-chat -n 100 --no-pager

# Porte in ascolto
ss -tlnp

# Aggiornare un'app
cd /srv/apps/raspi-chat && git pull && sudo systemctl restart raspi-chat
cd /srv/apps/raspi-admin && git pull && sudo systemctl restart raspi-admin
cd ~/magazzino-sereno && git pull && sudo systemctl restart magazzino
cd /srv/apps/pillo && git pull && npm ci --omit=dev && sudo systemctl restart pillo
cd /srv/apps/jobseeker && git pull && sudo systemctl restart jobseeker
```

---

## Analytics

Tutte le pagine sotto `tongatron.org` caricano `https://tongatron.org/analytics.js`.
Provider: Google Analytics 4 — property `G-S4XSYK0QB7`, Consent Mode v2.

```html
<script async src="https://tongatron.org/analytics.js"></script>
```

---

## Note operative

- `raspi-admin` è il pannello di controllo principale: gestisce servizi systemd, log, repo GitHub dalla UI web.
- Variabili sensibili sono in `.env` nelle singole app — mai committare.
- `alcol-monitor` sul Raspberry è deprecato; la versione attiva è `alcol-monitor2` sul Server HP (`alcol-monitor.tongatron.org`).
- ⚠️ La feature **Storage** di raspi-admin puntava a `raspi2.local` (nodo **dismesso**) — `raspi2` è stato rimosso da `REMOTE_NODES`. L'upload è quindi non funzionante finché non si ripunta `STORAGE_NODE`/`STORAGE_PATH` (nel `.env`) a un host vivo, es. l'HP (`giovanni@192.168.1.173`, che ha ~88 GB liberi).
- Aggiornare questo file ogni volta che si aggiunge un servizio, cambia porta, o si modifica un tunnel Cloudflare.
