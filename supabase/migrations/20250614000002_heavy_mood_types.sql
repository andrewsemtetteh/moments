-- Deeper emotional mood check-ins

ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'heartbroken';
ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'crying';
ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'hurt';
ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'emotional';
ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'missing';
