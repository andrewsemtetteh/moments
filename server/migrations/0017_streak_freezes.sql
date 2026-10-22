-- Streak freezes (like Duolingo's): each person holds up to 2, earning one every 7 days of
-- their streak. Missing a day uses one automatically, so the streak carries on (it doesn't
-- grow that day). The days a freeze covered are kept so the calendar can show them frozen.

ALTER TABLE streaks ADD COLUMN user_1_freezes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE streaks ADD COLUMN user_2_freezes INTEGER NOT NULL DEFAULT 0;

CREATE TABLE user_streak_frozen_days (
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  frozen_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (relationship_id, user_id, frozen_date)
);

-- Everyone already on a streak of a week or more starts with one.
UPDATE streaks SET user_1_freezes = 1 WHERE user_1_streak >= 7;
UPDATE streaks SET user_2_freezes = 1 WHERE user_2_streak >= 7;
