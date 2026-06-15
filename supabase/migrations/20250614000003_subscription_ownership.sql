-- Plus follows the payer: user-level entitlement + relationship owner who shares it with their partner.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'plus')),
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revenuecat_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS revenuecat_subscription_id TEXT;

ALTER TABLE public.relationships
  ADD COLUMN IF NOT EXISTS subscription_owner_id UUID REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_relationships_subscription_owner
  ON public.relationships(subscription_owner_id)
  WHERE subscription_owner_id IS NOT NULL;

COMMENT ON COLUMN public.users.subscription_tier IS
  'Personal entitlement for the paying user; survives leaving a relationship until expiry.';
COMMENT ON COLUMN public.relationships.subscription_owner_id IS
  'User who pays for Plus in this space; both partners get subscription_tier while the space is active.';
