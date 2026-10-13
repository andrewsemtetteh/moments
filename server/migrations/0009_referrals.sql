-- Referrals: invite another couple, both couples get 14 days of Plus once the
-- invited couple pairs. The bonus lives in its own column so RevenueCat
-- (which owns subscription_*) never overwrites it.

ALTER TABLE users ADD COLUMN referral_code TEXT;
ALTER TABLE users ADD COLUMN referred_by TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

ALTER TABLE relationships ADD COLUMN bonus_plus_until TEXT;

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL,
  referred_user_id TEXT NOT NULL UNIQUE,
  relationship_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  credited_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id, credited_at);
