-- Individual streaks (like Paired): each partner has their own streak, from their own
-- daily check-in (a moment, a mood, or today's question). The existing couple columns
-- (current_streak, longest_streak, last_active_date) become the "together" streak:
-- days you BOTH showed up.

ALTER TABLE streaks ADD COLUMN user_1_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE streaks ADD COLUMN user_1_longest INTEGER NOT NULL DEFAULT 0;
ALTER TABLE streaks ADD COLUMN user_1_restorable INTEGER;
ALTER TABLE streaks ADD COLUMN user_1_lost_at TEXT;
ALTER TABLE streaks ADD COLUMN user_2_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE streaks ADD COLUMN user_2_longest INTEGER NOT NULL DEFAULT 0;
ALTER TABLE streaks ADD COLUMN user_2_restorable INTEGER;
ALTER TABLE streaks ADD COLUMN user_2_lost_at TEXT;

-- Each person's own showed-up days (their calendar).
CREATE TABLE user_streak_days (
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  activity_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (relationship_id, user_id, activity_date)
);

-- Nobody loses progress: each partner starts from the couple streak they had, if they
-- themselves checked in today or yesterday (so it's still alive for them). Someone who
-- hadn't starts at 0 quietly, instead of being told their streak just ended.
UPDATE streaks SET
  user_1_streak = CASE WHEN user_1_last_active_date >= date('now', '-1 day') THEN current_streak ELSE 0 END,
  user_2_streak = CASE WHEN user_2_last_active_date >= date('now', '-1 day') THEN current_streak ELSE 0 END,
  user_1_longest = longest_streak,
  user_2_longest = longest_streak;

INSERT OR IGNORE INTO user_streak_days (relationship_id, user_id, activity_date)
  SELECT d.relationship_id, r.user_1_id, d.activity_date
  FROM streak_active_days d JOIN relationships r ON r.id = d.relationship_id;

INSERT OR IGNORE INTO user_streak_days (relationship_id, user_id, activity_date)
  SELECT d.relationship_id, r.user_2_id, d.activity_date
  FROM streak_active_days d JOIN relationships r ON r.id = d.relationship_id
  WHERE r.user_2_id IS NOT NULL;
