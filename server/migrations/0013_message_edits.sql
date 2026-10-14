-- Sender can edit a text message for a short while; the bubble then shows "Edited".
ALTER TABLE messages ADD COLUMN edited_at TEXT;
