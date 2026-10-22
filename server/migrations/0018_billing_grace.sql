-- A renewal that fails (card declined, expired) isn't the end: the store keeps retrying,
-- so Plus stays on for a grace period instead of switching off at once. This marks when
-- the store first told us about the payment problem; a successful renewal clears it.
ALTER TABLE users ADD COLUMN billing_issue_at TEXT;
