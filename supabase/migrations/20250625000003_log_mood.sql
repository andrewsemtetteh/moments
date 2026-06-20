-- Reliable mood logging: validates membership and bypasses fragile client-side RLS edge cases.

CREATE OR REPLACE FUNCTION public.log_mood(
  p_relationship_id UUID,
  p_mood TEXT
)
RETURNS public.mood_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_log public.mood_logs;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_mood IS NULL OR btrim(p_mood) = '' THEN
    RAISE EXCEPTION 'Mood is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.relationships r
    WHERE r.id = p_relationship_id
      AND r.status <> 'ended'
      AND (r.user_1_id = v_user_id OR r.user_2_id = v_user_id)
  ) THEN
    RAISE EXCEPTION 'Not allowed to log mood for this relationship';
  END IF;

  INSERT INTO public.mood_logs (relationship_id, user_id, mood)
  VALUES (p_relationship_id, v_user_id, p_mood::public.mood_type)
  RETURNING * INTO v_log;

  RETURN v_log;
END;
$$;

REVOKE ALL ON FUNCTION public.log_mood(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_mood(UUID, TEXT) TO authenticated;
