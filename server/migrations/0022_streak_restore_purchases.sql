-- Paid streak restores ($0.99, a one-time "consumable" purchase). Each purchase is one row, keyed by
-- the store's transaction id so a webhook retry can't add a second; restoring a streak uses the
-- oldest unused one. A person's unused rows are the restores they've paid for and not used yet.
CREATE TABLE streak_restore_purchases (
  transaction_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  used_at TEXT
);

CREATE INDEX idx_streak_restore_unused ON streak_restore_purchases (user_id, used_at);
