-- Indexes for lookups the app makes all the time (found in the performance audit).

-- The unread count (Chat badge, Home's Continue chat): a couple's messages not read yet.
-- Partial: only unread rows are in it, so it stays small however long the chat gets.
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(relationship_id, sender_id) WHERE read_at IS NULL;

-- One kind of activity for a couple, newest first (gratitude swap and the other shared activities).
CREATE INDEX IF NOT EXISTS idx_activities_rel_type ON activities(relationship_id, type, created_at DESC);
