-- Without these, per-couple lookups scan every row in the table and count each one against D1's daily row-read quota.
CREATE INDEX IF NOT EXISTS idx_daily_challenges_relationship ON daily_challenges(relationship_id);
CREATE INDEX IF NOT EXISTS idx_bucket_list_relationship ON bucket_list(relationship_id);
CREATE INDEX IF NOT EXISTS idx_shared_goals_relationship ON shared_goals(relationship_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_relationship ON game_sessions(relationship_id);
