-- Cleaner notification copy (no em dashes / awkward hyphens)

CREATE OR REPLACE FUNCTION public.notify_partner_on_daily_challenge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_responder UUID;
  v_partner UUID;
  v_name TEXT;
  v_both BOOLEAN;
  v_dedup TEXT;
BEGIN
  IF OLD.user_1_response IS NULL AND NEW.user_1_response IS NOT NULL THEN
    SELECT r.user_1_id INTO v_responder
    FROM public.relationships r
    WHERE r.id = NEW.relationship_id;
  ELSIF OLD.user_2_response IS NULL AND NEW.user_2_response IS NOT NULL THEN
    SELECT r.user_2_id INTO v_responder
    FROM public.relationships r
    WHERE r.id = NEW.relationship_id;
  ELSE
    RETURN NEW;
  END IF;

  IF v_responder IS NULL THEN
    RETURN NEW;
  END IF;

  v_partner := public.relationship_partner_id(NEW.relationship_id, v_responder);
  IF v_partner IS NULL THEN
    RETURN NEW;
  END IF;

  v_both := NEW.user_1_response IS NOT NULL AND NEW.user_2_response IS NOT NULL;
  v_dedup := 'prompt_answer:' || NEW.id::text || ':' || v_responder::text || ':' ||
    CASE WHEN v_both THEN 'reveal' ELSE 'turn' END;

  IF NOT public.try_notification_dedup(NEW.relationship_id, v_dedup) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(btrim(u.name), ''), 'Your partner')
  INTO v_name
  FROM public.users u
  WHERE u.id = v_responder;

  IF v_both THEN
    PERFORM public.create_partner_notification(
      NEW.relationship_id,
      v_partner,
      'challenge',
      v_name || ' answered today''s question. You can both see the answers now.'
    );
  ELSE
    PERFORM public.create_partner_notification(
      NEW.relationship_id,
      v_partner,
      'challenge',
      v_name || ' answered today''s question. Your turn!'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_streak_at_risk(
  p_relationship_id UUID,
  p_current_streak INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_1 UUID;
  v_user_2 UUID;
  v_dedup TEXT;
BEGIN
  IF p_current_streak IS NULL OR p_current_streak <= 0 THEN
    RETURN;
  END IF;

  v_dedup := 'streak_at_risk:' || to_char(CURRENT_DATE, 'YYYY-MM-DD');
  IF NOT public.try_notification_dedup(p_relationship_id, v_dedup) THEN
    RETURN;
  END IF;

  SELECT user_1_id, user_2_id INTO v_user_1, v_user_2
  FROM public.relationships
  WHERE id = p_relationship_id;

  IF v_user_1 IS NOT NULL THEN
    PERFORM public.create_partner_notification(
      p_relationship_id,
      v_user_1,
      'streak',
      'Your ' || p_current_streak || ' day streak is at risk. Connect today to keep it going.'
    );
  END IF;

  IF v_user_2 IS NOT NULL THEN
    PERFORM public.create_partner_notification(
      p_relationship_id,
      v_user_2,
      'streak',
      'Your ' || p_current_streak || ' day streak is at risk. Connect today to keep it going.'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_streak_lost(
  p_relationship_id UUID,
  p_previous_streak INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_1 UUID;
  v_user_2 UUID;
  v_dedup TEXT;
BEGIN
  IF p_previous_streak IS NULL OR p_previous_streak <= 0 THEN
    RETURN;
  END IF;

  v_dedup := 'streak_lost:' || to_char(CURRENT_DATE, 'YYYY-MM-DD');
  IF NOT public.try_notification_dedup(p_relationship_id, v_dedup) THEN
    RETURN;
  END IF;

  SELECT user_1_id, user_2_id INTO v_user_1, v_user_2
  FROM public.relationships
  WHERE id = p_relationship_id;

  IF v_user_1 IS NOT NULL THEN
    PERFORM public.create_partner_notification(
      p_relationship_id,
      v_user_1,
      'streak',
      'Your ' || p_previous_streak || ' day streak ended. Start fresh together today.'
    );
  END IF;

  IF v_user_2 IS NOT NULL THEN
    PERFORM public.create_partner_notification(
      p_relationship_id,
      v_user_2,
      'streak',
      'Your ' || p_previous_streak || ' day streak ended. Start fresh together today.'
    );
  END IF;
END;
$$;

-- Soft-clean existing notification bodies already stored with dashes
UPDATE public.notifications
SET content = trim(both FROM regexp_replace(
  regexp_replace(
    regexp_replace(content, '(\d+)-day', '\1 day', 'gi'),
    E'\\s*[—–]\\s*',
    '. ',
    'g'
  ),
  E'\\s{2,}',
  ' ',
  'g'
))
WHERE content ~ '[—–]' OR content ~ '\\d+-day';
