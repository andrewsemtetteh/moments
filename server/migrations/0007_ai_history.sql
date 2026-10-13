-- What the AI has already generated for each couple, so new prompts can say "don't repeat these".
-- One row per generation (items as a JSON array of short strings); only the newest few per kind are kept.
CREATE TABLE ai_history (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  items TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_ai_history_rel_kind ON ai_history(relationship_id, kind, created_at DESC);
