-- Gender (with more choices than the old column allows) and birthday.
-- The old `gender` column only accepts male / female / other (a CHECK that SQLite can't
-- relax without rebuilding users), so gender lives in its own column now.

ALTER TABLE users ADD COLUMN gender_identity TEXT;
ALTER TABLE users ADD COLUMN birthday TEXT; -- YYYY-MM-DD, optional; your partner sees it

UPDATE users SET gender_identity = gender WHERE gender IS NOT NULL;
