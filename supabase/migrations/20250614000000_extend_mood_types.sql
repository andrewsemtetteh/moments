-- Extend mood_type enum for additional check-in moods

ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'loved';
ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'grateful';
ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'tired';
ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'anxious';
ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'sad';
ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'angry';
ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'playful';
ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'hopeful';
