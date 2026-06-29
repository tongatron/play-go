-- Schema iniziale play-go (vedi specs/001-go-mvp/data-model.md)

CREATE TABLE IF NOT EXISTS user (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS game (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT NOT NULL,                       -- 'vs_computer' | 'async_pvp'
  board_size    INTEGER NOT NULL,                    -- 9 | 13
  komi          REAL NOT NULL,
  black_user_id INTEGER REFERENCES user(id),
  white_user_id INTEGER REFERENCES user(id),
  ai_level      INTEGER,                             -- solo vs_computer
  ai_color      TEXT,                                -- 'B' | 'W' (lato AI), solo vs_computer
  status        TEXT NOT NULL,                       -- playing | scoring | finished | abandoned
  turn          TEXT,                                -- 'B' | 'W'
  result        TEXT,                                -- es. 'B+7.5', 'W+R'
  sgf           TEXT NOT NULL DEFAULT '',
  dead_black    TEXT,                                -- JSON: pietre marcate morte (in scoring)
  dead_white    TEXT,
  score_black_ok INTEGER NOT NULL DEFAULT 0,         -- conferma punteggio per colore
  score_white_ok INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_players ON game(black_user_id, white_user_id);
CREATE INDEX IF NOT EXISTS idx_game_status ON game(status);

CREATE TABLE IF NOT EXISTS challenge (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_user_id INTEGER NOT NULL REFERENCES user(id),
  board_size      INTEGER NOT NULL,
  komi            REAL NOT NULL,
  creator_color   TEXT NOT NULL,                     -- 'B' | 'W' | 'nigiri'
  status          TEXT NOT NULL,                     -- open | accepted | cancelled
  game_id         INTEGER REFERENCES game(id),
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS module_progress (
  user_id      INTEGER NOT NULL REFERENCES user(id),
  module_id    TEXT NOT NULL,
  status       TEXT NOT NULL,                        -- 'completed'
  completed_at TEXT,
  PRIMARY KEY (user_id, module_id)
);
