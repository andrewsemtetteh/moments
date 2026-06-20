-- Production notifications: push tokens, centralized partner notifications,
-- mood + streak triggers, mark-read RPC, dedup for streak alerts.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT,
  ADD COLUMN IF NOT EXISTS expo_push_token_updated_at TIMESTAMPTZ;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_dispatched BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_push_pending
  ON public.notifications (user_id, push_dispatched, created_at DESC)
  WHERE push_dispatched = FALSE;

-- Prevent duplicate streak alerts within the same calendar day.
CREATE TABLE IF NOT EXISTS public.notification_dedup (
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  dedup_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (relationship_id, dedup_key)
);

ALTER TABLE public.notification_dedup ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_dedup_service ON public.notification_dedup
  FOR ALL USING (false) WITH CHECK (false);

-- Resolve partner id for an active relationship.
CREATE OR REPLACE FUNCTION public.relationship_partner_id(
  p_relationship_id UUID,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN r.user_1_id = p_user_id THEN r.user_2_id
    WHEN r.user_2_id = p_user_id THEN r.user_1_id
    ELSE NULL
  END
  FROM public.relationships r
  WHERE r.id = p_relationship_id
    AND r.status = 'active'
    AND (r.user_1_id = p_user_id OR r.user_2_id = p_user_id);
$$;

-- Central insert for all partner-targeted in-app notifications.
CREATE OR REPLACE FUNCTION public.create_partner_notification(
  p_relationship_id UUID,
  p_recipient_id UUID,
  p_type TEXT,
  p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_type IS NULL OR btrim(p_type) = '' OR p_content IS NULL OR btrim(p_content) = '' THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.relationships r
    WHERE r.id = p_relationship_id
      AND r.status = 'active'
      AND (r.user_1_id = p_recipient_id OR r.user_2_id = p_recipient_id)
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (relationship_id, user_id, type, content)
  VALUES (p_relationship_id, p_recipient_id, p_type, p_content)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.try_notification_dedup(
  p_relationship_id UUID,
  p_dedup_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_dedup (relationship_id, dedup_key)
  VALUES (p_relationship_id, p_dedup_key)
  ON CONFLICT DO NOTHING;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.mood_label(p_mood TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(p_mood)
    WHEN 'happy' THEN 'Happy'
    WHEN 'excited' THEN 'Excited'
    WHEN 'calm' THEN 'Calm'
    WHEN 'stressed' THEN 'Stressed'
    WHEN 'lonely' THEN 'Lonely'
    WHEN 'loved' THEN 'Loved'
    WHEN 'grateful' THEN 'Grateful'
    WHEN 'tired' THEN 'Tired'
    WHEN 'anxious' THEN 'Anxious'
    WHEN 'sad' THEN 'Sad'
    WHEN 'angry' THEN 'Angry'
    WHEN 'playful' THEN 'Playful'
    WHEN 'hopeful' THEN 'Hopeful'
    WHEN 'funny' THEN 'Funny'
    WHEN 'flirty' THEN 'Flirty'
    WHEN 'sexy' THEN 'Sexy'
    WHEN 'spicy' THEN 'Spicy'
    WHEN 'romantic' THEN 'Romantic'
    WHEN 'silly' THEN 'Silly'
    WHEN 'heartbroken' THEN 'Heartbroken'
    WHEN 'crying' THEN 'Crying'
    WHEN 'hurt' THEN 'Hurt'
    WHEN 'emotional' THEN 'Emotional'
    WHEN 'missing' THEN 'Missing you'
    ELSE initcap(replace(p_mood, '_', ' '))
  END;
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
    v_name || ' is feeling ' || public.mood_label(NEW.mood)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_partner_on_mood ON public.mood_logs;
CREATE TRIGGER notify_partner_on_mood
  AFTER INSERT ON public.mood_logs
  FOR EACH ROW EXECUTE FUNCTION public.notify_partner_on_mood();

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
      'Your ' || p_previous_streak || '-day streak ended. Start fresh together today.'
    );
  END IF;

  IF v_user_2 IS NOT NULL THEN
    PERFORM public.create_partner_notification(
      p_relationship_id,
      v_user_2,
      'streak',
      'Your ' || p_previous_streak || '-day streak ended. Start fresh together today.'
    );
  END IF;
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
      'Your ' || p_current_streak || '-day streak is at risk — connect today to keep it going.'
    );
  END IF;

  IF v_user_2 IS NOT NULL THEN
    PERFORM public.create_partner_notification(
      p_relationship_id,
      v_user_2,
      'streak',
      'Your ' || p_current_streak || '-day streak is at risk — connect today to keep it going.'
    );
  END IF;
END;
$$;

-- Replace normalize_streak_if_broken to emit streak-lost notifications.
CREATE OR REPLACE FUNCTION public.normalize_streak_if_broken(p_relationship_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last DATE;
  v_current INT;
  v_today DATE := CURRENT_DATE;
BEGIN
  SELECT last_active_date, current_streak
  INTO v_last, v_current
  FROM public.streaks
  WHERE relationship_id = p_relationship_id
  FOR UPDATE;

  IF v_last IS NOT NULL AND v_last < v_today - 1 THEN
    PERFORM public.notify_streak_lost(p_relationship_id, v_current);

    UPDATE public.streaks
    SET current_streak = 0, updated_at = NOW()
    WHERE relationship_id = p_relationship_id;

    UPDATE public.relationships
    SET streak_count = 0
    WHERE id = p_relationship_id;
  END IF;
END;
$$;

-- Extend get_streak_status to emit at-risk notifications once per day.
CREATE OR REPLACE FUNCTION public.get_streak_status(p_relationship_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.streaks%ROWTYPE;
  v_user_1 UUID;
  v_user_2 UUID;
  v_today DATE := CURRENT_DATE;
  v_effective INT;
  v_at_risk BOOLEAN;
  v_both_today BOOLEAN;
  v_user_today BOOLEAN;
  v_partner_today BOOLEAN;
  v_uid UUID := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.relationships r
    WHERE r.id = p_relationship_id
      AND r.id IN (SELECT public.user_relationship_ids())
  ) THEN
    RAISE EXCEPTION 'Relationship not found';
  END IF;

  PERFORM public.normalize_streak_if_broken(p_relationship_id);

  SELECT user_1_id, user_2_id INTO v_user_1, v_user_2
  FROM public.relationships
  WHERE id = p_relationship_id;

  SELECT * INTO v_row
  FROM public.streaks
  WHERE relationship_id = p_relationship_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'relationship_id', p_relationship_id,
      'current_streak', 0,
      'longest_streak', 0,
      'last_active_date', NULL,
      'at_risk', false,
      'both_active_today', false,
      'user_active_today', false,
      'partner_active_today', false
    );
  END IF;

  v_effective := v_row.current_streak;
  v_at_risk := v_row.last_active_date = v_today - 1 AND v_effective > 0;

  IF v_at_risk THEN
    PERFORM public.notify_streak_at_risk(p_relationship_id, v_effective);
  END IF;

  v_both_today := v_row.user_1_last_active_date = v_today AND v_row.user_2_last_active_date = v_today;

  IF v_uid = v_user_1 THEN
    v_user_today := v_row.user_1_last_active_date = v_today;
    v_partner_today := v_user_2 IS NOT NULL AND v_row.user_2_last_active_date = v_today;
  ELSIF v_uid = v_user_2 THEN
    v_user_today := v_row.user_2_last_active_date = v_today;
    v_partner_today := v_row.user_1_last_active_date = v_today;
  ELSE
    v_user_today := false;
    v_partner_today := false;
  END IF;

  RETURN jsonb_build_object(
    'relationship_id', p_relationship_id,
    'current_streak', v_effective,
    'longest_streak', v_row.longest_streak,
    'last_active_date', v_row.last_active_date,
    'at_risk', v_at_risk,
    'both_active_today', v_both_today,
    'user_active_today', v_user_today,
    'partner_active_today', v_partner_today
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.register_push_token(p_token TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_token IS NULL OR btrim(p_token) = '' THEN
    UPDATE public.users
    SET expo_push_token = NULL, expo_push_token_updated_at = NOW()
    WHERE id = auth.uid();
    RETURN;
  END IF;

  UPDATE public.users
  SET expo_push_token = p_token, expo_push_token_updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_notification_ids UUID[] DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_notification_ids IS NULL OR array_length(p_notification_ids, 1) IS NULL THEN
    UPDATE public.notifications
    SET read = TRUE
    WHERE user_id = auth.uid()
      AND read = FALSE;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
  END IF;

  UPDATE public.notifications
  SET read = TRUE
  WHERE user_id = auth.uid()
    AND id = ANY (p_notification_ids)
    AND read = FALSE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_push_notifications(p_limit INT DEFAULT 10)
RETURNS SETOF public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  UPDATE public.notifications n
  SET push_dispatched = TRUE
  FROM (
    SELECT id
    FROM public.notifications
    WHERE push_dispatched = FALSE
      AND relationship_id IN (SELECT public.user_relationship_ids())
    ORDER BY created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 25))
  ) pending
  WHERE n.id = pending.id
  RETURNING n.*;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_partner_notification(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_push_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_notifications(int) TO authenticated;
