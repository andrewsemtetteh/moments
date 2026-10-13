-- Shared AI content: generated in batches once, served to every couple. Each couple keeps a cursor per
-- bank so they never see an item twice; the AI is only called when someone reaches the end of a bank.
DROP TABLE IF EXISTS ai_history;

CREATE TABLE content_bank (
  bank TEXT NOT NULL,
  seq INTEGER NOT NULL,
  item TEXT NOT NULL,
  norm TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (bank, seq),
  UNIQUE (bank, norm)
);

CREATE TABLE content_cursor (
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  bank TEXT NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (relationship_id, bank)
);

-- Everyone gets the same question on a given date; bank_seq points into the 'daily' bank.
CREATE TABLE daily_questions (
  date TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  bank_seq INTEGER
);
