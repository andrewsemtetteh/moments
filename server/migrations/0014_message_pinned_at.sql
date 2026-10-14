-- When a message was pinned: orders the pinned bar and decides which pin is "oldest"
-- when the chat's 3-pin limit is reached.
ALTER TABLE messages ADD COLUMN pinned_at TEXT;
UPDATE messages SET pinned_at = created_at WHERE is_pinned = 1;
