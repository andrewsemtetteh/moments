-- Moments Plus billing (RevenueCat).
--
-- One subscription covers the couple: the RevenueCat webhook writes Plus onto the buyer's
-- relationship, so both partners unlock. Only the server writes these columns (clients can't).

ALTER TABLE relationships ADD COLUMN subscription_expires_at TEXT;
-- 'trial' while the free trial runs, 'normal' once paying (RevenueCat's period_type).
ALTER TABLE relationships ADD COLUMN subscription_period TEXT;
-- Store product id, e.g. plus_weekly / plus_yearly / plus_monthly.
ALTER TABLE relationships ADD COLUMN subscription_product TEXT;

-- AI generations per couple, for the monthly fair-use cap (trial and paid alike).
-- period_key: 'month:YYYY-MM'.
CREATE TABLE ai_usage (
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (relationship_id, period_key, kind)
);

-- Webhook events already applied (RevenueCat retries; this keeps them idempotent).
CREATE TABLE billing_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  app_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
