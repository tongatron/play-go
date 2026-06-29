# Quickstart (Fase 1) — play-go

## Sviluppo locale (Mac)

```bash
git clone <repo> play-go && cd play-go
npm install
cp deploy/.env.example .env   # imposta COOKIE_SECRET, PORT=3504, HOST=127.0.0.1
npm test                      # motore regole + validazione mosse + SGF (node:test)
npm run dev                   # http://localhost:3504
```

GNU Go in locale (per testare l'avversario): `brew install gnu-go` (macOS — la
formula si chiama `gnu-go` ma installa il binario `gnugo`). Su Raspbian è `apt install gnugo`.

## Deploy sul Raspberry Pi 3

Coerente con i pattern di `raspi3.md` (service systemd + tunnel Cloudflare).

```bash
# 1. Dipendenza di sistema
sudo apt install gnugo           # 3.8-13, confermato disponibile su trixie armv7l

# 2. Codice
sudo mkdir -p /srv/apps/play-go && sudo chown giovanni: /srv/apps/play-go
cd /srv/apps && git clone https://github.com/tongatron/play-go.git
cd play-go && npm ci --omit=dev   # verifica build better-sqlite3/argon2 su armv7l

# 3. Config
cp deploy/.env.example .env        # COOKIE_SECRET (random), PORT=3504, HOST=127.0.0.1

# 4. Service systemd
sudo cp deploy/play-go.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now play-go
journalctl -u play-go -f

# 5. Tunnel Cloudflare → go.tongatron.org
cloudflared tunnel route dns 8521f89c-9038-474b-886b-71fb4ae98bc6 go.tongatron.org
# aggiungere l'ingress go.tongatron.org → http://localhost:3504 in /etc/cloudflared/config.yml
sudo systemctl restart cloudflared.service
```

## Aggiornamenti

```bash
cd /srv/apps/play-go && git pull && npm ci --omit=dev && sudo systemctl restart play-go
```

## Post-deploy
- Aggiornare `raspi3.md`: nuova riga porta 3504 (`play-go.service`), hostname
  `go.tongatron.org`, percorso `/srv/apps/play-go`.
- Verificare RAM sotto carico (≤3 partite vs computer) — il Pi ha ~389 MB liberi.

## Vincoli da ricordare
- `better-sqlite3` e `argon2` sono moduli nativi: se `npm ci` fallisce su armv7l,
  valutare i fallback indicati in [research.md](research.md) (D2, D7).
- Una istanza GNU Go per partita, terminata a fine mossa/partita; mai processi AI
  residenti.
