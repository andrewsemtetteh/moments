-- Small shared documents per couple, synced between both phones:
-- 'albums' (moment albums) and 'places' (names they give map places).
-- `version` goes up on every write so concurrent edits don't overwrite each other.
CREATE TABLE IF NOT EXISTS couple_docs (
  relationship_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT,
  PRIMARY KEY (relationship_id, kind)
);
