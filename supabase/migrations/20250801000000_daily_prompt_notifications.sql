-- Notify partner when someone answers today's prompt (daily_challenges).
-- Safe with client-side notify: uses dedup key so duplicates are skipped for the same answer event.

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

  -- Skip if client (or a prior trigger) already notified for this exact event today.
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
      v_name || ' answered today''s question — you can both see the answers now'
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

DROP TRIGGER IF EXISTS notify_partner_on_daily_challenge ON public.daily_challenges;
CREATE TRIGGER notify_partner_on_daily_challenge
  AFTER UPDATE ON public.daily_challenges
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_partner_on_daily_challenge();
