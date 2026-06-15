-- Single paid tier: plus (legacy premium rows map to plus).

UPDATE public.users SET subscription_tier = 'plus' WHERE subscription_tier = 'premium';
UPDATE public.relationships SET subscription_tier = 'plus' WHERE subscription_tier = 'premium';

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_subscription_tier_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'plus'));

ALTER TABLE public.relationships DROP CONSTRAINT IF EXISTS relationships_subscription_tier_check;
ALTER TABLE public.relationships
  ADD CONSTRAINT relationships_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'plus'));
