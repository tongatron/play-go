# Data Model (Fase 1) — play-go MVP

Schema relazionale su SQLite. Riferimento entità: [spec.md](spec.md) §Key Entities.
I nomi sono indicativi; le migrazioni vivranno in `src/db/migrations/`.

## Entità

### user
| Campo | Tipo | Note |
|---|---|---|
| id | INTEGER PK | |
| username | TEXT UNIQUE NOT NULL | validato (lunghezza/caratteri) |
| password_hash | TEXT NOT NULL | argon2id/bcrypt — mai in chiaro |
| created_at | TEXT NOT NULL | ISO8601 |

### game
| Campo | Tipo | Note |
|---|---|---|
| id | INTEGER PK | |
| type | TEXT NOT NULL | `vs_computer` \| `async_pvp` |
| board_size | INTEGER NOT NULL | 9 \| 13 |
| komi | REAL NOT NULL | default per regole cinesi (es. 7.5) |
| black_user_id | INTEGER FK→user | NULL se computer |
| white_user_id | INTEGER FK→user | NULL se computer |
| ai_level | INTEGER | solo `vs_computer` |
| status | TEXT NOT NULL | `playing` \| `scoring` \| `finished` \| `abandoned` |
| turn | TEXT | `B` \| `W` — colore di turno |
| result | TEXT | es. `B+7.5`, `W+R` (resign), `Draw` |
| sgf | TEXT | partita completa in SGF (fonte di verità del replay) |
| created_at | TEXT NOT NULL | |
| updated_at | TEXT NOT NULL | usato per timeout abbandono async (14gg) |

> Lo stato di gioco autoritativo è ricostruibile dall'SGF tramite `src/go/`. La colonna
> `turn`/`status` è cache derivata per query rapide.

### move *(opzionale se SGF è sufficiente)*
| Campo | Tipo | Note |
|---|---|---|
| id | INTEGER PK | |
| game_id | INTEGER FK→game | |
| ordinal | INTEGER NOT NULL | ordine mossa |
| color | TEXT NOT NULL | `B` \| `W` |
| point | TEXT | coord (es. `D4`) o NULL per pass |
| kind | TEXT NOT NULL | `play` \| `pass` \| `resign` |
| created_at | TEXT NOT NULL | |

> Decisione in fase di implementazione: tenere le mosse solo dentro l'SGF (semplice) o
> anche in tabella `move` (query/audit più comodi). Default proposto: **solo SGF** per
> l'MVP, `move` aggiunta se serve.

### challenge
| Campo | Tipo | Note |
|---|---|---|
| id | INTEGER PK | |
| creator_user_id | INTEGER FK→user NOT NULL | |
| board_size | INTEGER NOT NULL | 9 \| 13 |
| komi | REAL NOT NULL | |
| creator_color | TEXT | `B` \| `W` \| `nigiri` |
| status | TEXT NOT NULL | `open` \| `accepted` \| `cancelled` |
| game_id | INTEGER FK→game | valorizzato all'accettazione |
| created_at | TEXT NOT NULL | |

### module *(contenuto in file, non in DB)*
Definito in `src/content/modules/*.json`. Schema logico:
| Campo | Tipo | Note |
|---|---|---|
| id | TEXT | slug stabile (es. `01-cattura`) |
| title | TEXT | titolo IT |
| order | INTEGER | ordinamento |
| prerequisites | TEXT[] | id di altri moduli |
| lesson | — | testo/markdown IT + diagrammi SGF |
| exercises | — | lista di esercizi (SGF posizione + sequenza/e soluzione) |

### module_progress
| Campo | Tipo | Note |
|---|---|---|
| user_id | INTEGER FK→user | |
| module_id | TEXT | id del modulo (file) |
| status | TEXT NOT NULL | `completed` (MVP) |
| completed_at | TEXT | |
| | | PK composta (user_id, module_id) |

## Relazioni
- `user` 1—N `game` (come black/white); `game` 0/1—1 motore AI.
- `user` 1—N `challenge`; `challenge` 0/1—1 `game`.
- `user` N—N `module` tramite `module_progress`.

## Note di integrità / stato
- Transizioni `game.status`: `playing → scoring → finished`; `playing → finished`
  (resign); `playing → abandoned` (14gg inattività async).
- `module_progress` esiste solo per moduli completati (assenza = non completato).
- Sblocco modulo: tutti i `prerequisites` presenti in `module_progress` dell'utente.
