-- Online status visibility + durable last-seen for partner status
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.show_online_status IS
  'When false, partner sees Away and this user does not broadcast online presence';
COMMENT ON COLUMN public.users.last_seen_at IS
  'Last time this user was actively online (for last-seen labels)';

UPDATE public.users
SET show_online_status = TRUE
WHERE show_online_status IS NULL;
