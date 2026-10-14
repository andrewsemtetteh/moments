-- Per-user notification preferences: {"messages": false, ...}. Missing keys mean on.
ALTER TABLE users ADD COLUMN notification_prefs TEXT NOT NULL DEFAULT '{}';
