-- App-level rate limiting for Edge Functions (service_role only).

CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  bucket_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hit_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_updated_at ON public.edge_rate_limits (updated_at);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_bucket_key TEXT,
  p_max_hits INT,
  p_window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INT;
BEGIN
  IF p_bucket_key IS NULL OR length(trim(p_bucket_key)) = 0 THEN
    RAISE EXCEPTION 'bucket_key is required';
  END IF;

  IF p_max_hits < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'invalid rate limit parameters';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM NOW()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.edge_rate_limits (bucket_key, window_start, hit_count)
  VALUES (p_bucket_key, v_window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET
    hit_count = public.edge_rate_limits.hit_count + 1,
    updated_at = NOW()
  RETURNING hit_count INTO v_count;

  -- Best-effort cleanup of windows older than 7 days.
  DELETE FROM public.edge_rate_limits
  WHERE updated_at < NOW() - INTERVAL '7 days';

  RETURN v_count <= p_max_hits;
END;
$$;

REVOKE ALL ON TABLE public.edge_rate_limits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.edge_rate_limits TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INT, INT) TO service_role;
