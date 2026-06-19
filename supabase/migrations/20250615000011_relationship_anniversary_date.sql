-- Optional relationship anniversary (month/day + year for "together since")
ALTER TABLE public.relationships
  ADD COLUMN IF NOT EXISTS anniversary_date DATE;

COMMENT ON COLUMN public.relationships.anniversary_date IS
  'Couple anniversary date for countdown; falls back to created_at when null.';
