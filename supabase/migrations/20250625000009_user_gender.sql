-- Profile gender for onboarding (male, female, other)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other'));
