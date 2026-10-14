-- Moments Plus billing moves from RevenueCat to Superwall.
--
-- The app identifies each person with Superwall by a UUID derived from their Clerk id (StoreKit
-- only accepts UUIDs as appAccountToken). The server fills billing_user_id the first time it sees
-- the person, so the Superwall webhook can map originalAppUserId back to them.

ALTER TABLE users ADD COLUMN billing_user_id TEXT;
CREATE UNIQUE INDEX idx_users_billing_user_id ON users(billing_user_id);

-- Provider-neutral names for the RevenueCat-era columns.
-- billing_subscription_id: the store's original transaction id (one per subscription).
ALTER TABLE users RENAME COLUMN revenuecat_customer_id TO billing_subscription_id;
ALTER TABLE users RENAME COLUMN revenuecat_subscription_id TO billing_product_id;
