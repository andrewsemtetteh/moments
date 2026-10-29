-- Registering a push token clears it from any other account first (one phone, one account):
-- `UPDATE users ... WHERE expo_push_token = ?`, which scanned every user without this.
CREATE INDEX IF NOT EXISTS idx_users_push_token ON users(expo_push_token);
