-- Location moments: store map coordinates alongside text label
ALTER TABLE public.moments
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN public.moments.latitude IS 'GPS latitude for location-type moments';
COMMENT ON COLUMN public.moments.longitude IS 'GPS longitude for location-type moments';
