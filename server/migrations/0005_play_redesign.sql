-- Own-time (async) games persist the same RoomState the live rooms broadcast. `version` lets
-- each phone compare-and-swap its move so two near-simultaneous moves can't overwrite each other.
ALTER TABLE game_sessions ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_sessions ADD COLUMN created_by TEXT;
ALTER TABLE game_sessions ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
CREATE INDEX IF NOT EXISTS idx_game_sessions_rel_status ON game_sessions(relationship_id, status, updated_at DESC);

-- Handpicked question packs: one locked-in answer per person per question.
CREATE TABLE pack_answers (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  pack_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  choice TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (relationship_id, user_id, pack_id, question_id)
);
CREATE INDEX idx_pack_answers_rel_pack ON pack_answers(relationship_id, pack_id);
