-- Fun & flirty mood check-ins for couples

ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'funny';
ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'flirty';
ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'sexy';
ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'spicy';
ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'romantic';
ALTER TYPE public.mood_type ADD VALUE IF NOT EXISTS 'silly';
