-- Optional relationship situation for personalization (not tied to distance_mode)
ALTER TABLE public.relationships
  ADD COLUMN IF NOT EXISTS relationship_type TEXT
  CHECK (relationship_type IN ('dating', 'long_distance', 'engaged', 'married', 'other'));
