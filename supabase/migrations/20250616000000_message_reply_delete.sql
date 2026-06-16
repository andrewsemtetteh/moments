-- Reply threading and per-user / global message deletion
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_for_all BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hidden_for UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to_id)
  WHERE reply_to_id IS NOT NULL;
