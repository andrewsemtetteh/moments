-- Fields from the app's UserProfile/Relationship types that 0001 didn't cover yet.

ALTER TABLE users ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female', 'other'));
ALTER TABLE users ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'plus'));
ALTER TABLE users ADD COLUMN subscription_expires_at TEXT;
ALTER TABLE users ADD COLUMN revenuecat_customer_id TEXT;
ALTER TABLE users ADD COLUMN revenuecat_subscription_id TEXT;
ALTER TABLE users ADD COLUMN location_sharing_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN location_latitude REAL;
ALTER TABLE users ADD COLUMN location_longitude REAL;
ALTER TABLE users ADD COLUMN location_label TEXT;
ALTER TABLE users ADD COLUMN location_updated_at TEXT;
ALTER TABLE users ADD COLUMN show_online_status INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN last_seen_at TEXT;
ALTER TABLE users ADD COLUMN timezone TEXT;

ALTER TABLE relationships ADD COLUMN relationship_type TEXT CHECK (relationship_type IN ('dating', 'long_distance', 'engaged', 'married', 'other'));
