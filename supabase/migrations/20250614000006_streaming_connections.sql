-- External streaming platform connections (sign-in happens in browser, not in-app).

CREATE TABLE IF NOT EXISTS public.user_streaming_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL,
  account_label TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, platform_id)
);

CREATE INDEX IF NOT EXISTS idx_streaming_connections_user
  ON public.user_streaming_connections(user_id);

ALTER TABLE public.user_streaming_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY streaming_connections_select ON public.user_streaming_connections FOR SELECT USING (
  user_id = auth.uid()
  OR user_id IN (
    SELECT CASE
      WHEN user_1_id = auth.uid() THEN user_2_id
      WHEN user_2_id = auth.uid() THEN user_1_id
    END
    FROM relationships
    WHERE status = 'active'
      AND (user_1_id = auth.uid() OR user_2_id = auth.uid())
  )
);

CREATE POLICY streaming_connections_mutate ON public.user_streaming_connections FOR ALL USING (
  user_id = auth.uid()
);
