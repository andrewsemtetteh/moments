-- Prefer active joined spaces, allow partner profile reads, and secure moment creation.

CREATE OR REPLACE FUNCTION public.user_relationship_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.relationships
  WHERE status <> 'ended'
    AND (user_1_id = auth.uid() OR user_2_id = auth.uid());
$$;

DROP POLICY IF EXISTS users_select ON public.users;

CREATE POLICY users_select ON public.users
  FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.relationships r
      WHERE r.status <> 'ended'
        AND (
          (r.user_1_id = auth.uid() AND r.user_2_id = users.id)
          OR (r.user_2_id = auth.uid() AND r.user_1_id = users.id)
        )
    )
  );

CREATE OR REPLACE FUNCTION public.get_partner_profile(p_user_id uuid)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.users;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Invalid partner';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.relationships r
    WHERE r.status <> 'ended'
      AND (
        (r.user_1_id = auth.uid() AND r.user_2_id = p_user_id)
        OR (r.user_2_id = auth.uid() AND r.user_1_id = p_user_id)
      )
  ) THEN
    RAISE EXCEPTION 'Partner not found';
  END IF;

  SELECT * INTO v_profile
  FROM public.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner not found';
  END IF;

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_moment(
  p_relationship_id uuid,
  p_type moment_type,
  p_media_url text,
  p_content text DEFAULT NULL
)
RETURNS public.moments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_moment public.moments;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.relationships r
    WHERE r.id = p_relationship_id
      AND r.status <> 'ended'
      AND (r.user_1_id = v_user_id OR r.user_2_id = v_user_id)
  ) THEN
    RAISE EXCEPTION 'Not allowed to add moments to this relationship';
  END IF;

  INSERT INTO public.moments (relationship_id, user_id, type, media_url, content)
  VALUES (p_relationship_id, v_user_id, p_type, p_media_url, p_content)
  RETURNING * INTO v_moment;

  RETURN v_moment;
END;
$$;

REVOKE ALL ON FUNCTION public.get_partner_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partner_profile(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.create_moment(uuid, moment_type, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_moment(uuid, moment_type, text, text) TO authenticated;
