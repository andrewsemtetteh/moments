-- Brings D1 to parity with the Supabase schema so the whole backend can move to Cloudflare.
-- moments / messages / mood_logs are rebuilt (relaxed CHECKs, extra columns); the app had no
-- production data on D1 before this migration.

DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS moments;
DROP TABLE IF EXISTS mood_logs;

CREATE TABLE moments (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  content TEXT,
  media_url TEXT,
  mood TEXT,
  latitude REAL,
  longitude REAL,
  reactions TEXT NOT NULL DEFAULT '{}',
  viewed_by TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_moments_relationship ON moments(relationship_id, created_at DESC);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id),
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  moment_id TEXT,
  reply_to_id TEXT,
  reactions TEXT NOT NULL DEFAULT '{}',
  is_pinned INTEGER NOT NULL DEFAULT 0,
  deleted_for_all INTEGER NOT NULL DEFAULT 0,
  read_at TEXT,
  hidden_for TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_messages_relationship ON messages(relationship_id, created_at DESC);

CREATE TABLE mood_logs (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  mood TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_mood_relationship ON mood_logs(relationship_id, created_at DESC);
CREATE INDEX idx_mood_user ON mood_logs(user_id, created_at DESC);

-- Notifications: optional preview + linked entity
ALTER TABLE notifications ADD COLUMN media_url TEXT;
ALTER TABLE notifications ADD COLUMN related_id TEXT;

-- Streaks: per-partner activity + restore window
ALTER TABLE streaks ADD COLUMN user_1_last_active_date TEXT;
ALTER TABLE streaks ADD COLUMN user_2_last_active_date TEXT;
ALTER TABLE streaks ADD COLUMN restorable_streak INTEGER;
ALTER TABLE streaks ADD COLUMN restorable_lost_at TEXT;

CREATE TABLE streak_active_days (
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  activity_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (relationship_id, activity_date)
);

CREATE TABLE notification_dedup (
  relationship_id TEXT NOT NULL,
  dedup_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (relationship_id, dedup_key)
);

CREATE TABLE quiz_live_sessions (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  host_user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'lobby',
  round_phase TEXT NOT NULL DEFAULT 'answer',
  questions TEXT NOT NULL DEFAULT '[]',
  current_index INTEGER NOT NULL DEFAULT 0,
  responses TEXT NOT NULL DEFAULT '{}',
  scores TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_quiz_live_rel ON quiz_live_sessions(relationship_id, created_at DESC);

CREATE TABLE couple_progress (
  relationship_id TEXT PRIMARY KEY REFERENCES relationships(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0,
  stats TEXT NOT NULL DEFAULT '{}',
  badges TEXT NOT NULL DEFAULT '[]',
  play_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  last_play_date TEXT,
  quests TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE rate_limits (
  bucket_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);
