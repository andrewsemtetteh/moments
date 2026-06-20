-- Split moments RLS: partners can update viewed_by/reactions on each other's moments.

DROP POLICY IF EXISTS moments_all ON public.moments;

CREATE POLICY moments_select ON public.moments
  FOR SELECT
  USING (relationship_id IN (SELECT public.user_relationship_ids()));

CREATE POLICY moments_insert ON public.moments
  FOR INSERT
  WITH CHECK (
    relationship_id IN (SELECT public.user_relationship_ids())
    AND user_id = auth.uid()
  );

CREATE POLICY moments_update ON public.moments
  FOR UPDATE
  USING (relationship_id IN (SELECT public.user_relationship_ids()))
  WITH CHECK (relationship_id IN (SELECT public.user_relationship_ids()));

CREATE POLICY moments_delete ON public.moments
  FOR DELETE
  USING (
    relationship_id IN (SELECT public.user_relationship_ids())
    AND user_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.mark_moment_viewed(p_moment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_viewed text[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT viewed_by INTO v_viewed
  FROM public.moments
  WHERE id = p_moment_id
    AND relationship_id IN (SELECT public.user_relationship_ids())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Moment not found';
  END IF;

  v_viewed := COALESCE(v_viewed, ARRAY[]::text[]);

  IF v_user_id::text = ANY(v_viewed) THEN
    RETURN;
  END IF;

  UPDATE public.moments
  SET viewed_by = array_append(v_viewed, v_user_id::text)
  WHERE id = p_moment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_moment_viewed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_moment_viewed(uuid) TO authenticated;
