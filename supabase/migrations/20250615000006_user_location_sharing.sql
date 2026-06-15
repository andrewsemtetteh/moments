-- Live location sharing between partners (privacy-controlled per user)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS location_sharing_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS location_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_label TEXT,
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.location_sharing_enabled IS 'When true, partner can see this user live location';
COMMENT ON COLUMN public.users.location_latitude IS 'Last shared latitude';
COMMENT ON COLUMN public.users.location_longitude IS 'Last shared longitude';
