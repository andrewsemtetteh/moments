-- mood_label accepts TEXT; NEW.mood is mood_type — cast so the notify trigger does not roll back inserts.

CREATE OR REPLACE FUNCTION public.mood_label(p_mood mood_type)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.mood_label(p_mood::TEXT);
$$;

CREATE OR REPLACE FUNCTION public.notify_partner_on_mood()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner UUID;
  v_name TEXT;
BEGIN
  v_partner := public.relationship_partner_id(NEW.relationship_id, NEW.user_id);
  IF v_partner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(btrim(u.name), ''), 'Your partner')
  INTO v_name
  FROM public.users u
  WHERE u.id = NEW.user_id;

  PERFORM public.create_partner_notification(
    NEW.relationship_id,
    v_partner,
    'mood',
    v_name || ' is feeling ' || public.mood_label(NEW.mood::TEXT)
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block mood logging if notification formatting fails.
    RETURN NEW;
END;
$$;
