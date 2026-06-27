-- Reliable anniversary updates for profile + onboarding (SECURITY DEFINER + membership check)
CREATE OR REPLACE FUNCTION public.set_relationship_anniversary(
  p_relationship_id uuid,
  p_anniversary_date date
)
RETURNS public.relationships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rel public.relationships;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.relationships r
  SET anniversary_date = p_anniversary_date
  WHERE r.id = p_relationship_id
    AND r.status <> 'ended'
    AND (r.user_1_id = auth.uid() OR r.user_2_id = auth.uid())
  RETURNING * INTO v_rel;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not allowed to update this relationship';
  END IF;

  RETURN v_rel;
END;
$$;

REVOKE ALL ON FUNCTION public.set_relationship_anniversary(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_relationship_anniversary(uuid, date) TO authenticated;
