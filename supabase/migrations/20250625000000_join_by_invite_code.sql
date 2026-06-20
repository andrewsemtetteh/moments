-- Join by invite code bypasses RLS: pending spaces are not visible to non-members via direct SELECT.
CREATE OR REPLACE FUNCTION public.join_relationship_by_invite(p_invite_code text)
RETURNS public.relationships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_code text := upper(trim(p_invite_code));
  v_rel public.relationships;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_code IS NULL OR length(v_code) < 6 THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  SELECT *
  INTO v_rel
  FROM public.relationships
  WHERE invite_code = v_code
    AND status = 'pending'
    AND user_2_id IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  IF v_rel.user_1_id = v_user_id THEN
    RAISE EXCEPTION 'That''s your own code. Share it with your partner, or enter their code instead.';
  END IF;

  UPDATE public.relationships
  SET
    status = 'ended',
    invite_code = NULL,
    subscription_tier = 'free',
    subscription_owner_id = NULL
  WHERE user_1_id = v_user_id
    AND user_2_id IS NULL
    AND status = 'pending'
    AND id <> v_rel.id;

  UPDATE public.relationships
  SET
    user_2_id = v_user_id,
    status = 'active',
    invite_code = NULL
  WHERE id = v_rel.id
  RETURNING * INTO v_rel;

  RETURN v_rel;
END;
$$;

REVOKE ALL ON FUNCTION public.join_relationship_by_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_relationship_by_invite(text) TO authenticated;
