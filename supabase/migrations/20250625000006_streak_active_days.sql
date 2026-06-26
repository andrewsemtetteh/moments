-- Persist calendar days when both partners qualified for the streak (for history UI).

CREATE TABLE IF NOT EXISTS public.streak_active_days (
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (relationship_id, activity_date)
);

CREATE INDEX IF NOT EXISTS idx_streak_active_days_rel_date
  ON public.streak_active_days(relationship_id, activity_date DESC);

ALTER TABLE public.streak_active_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY streak_active_days_select ON public.streak_active_days
  FOR SELECT
  USING (relationship_id IN (SELECT public.user_relationship_ids()));

CREATE OR REPLACE FUNCTION public.record_streak_active_day(p_relationship_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_u1 DATE;
  v_u2 DATE;
BEGIN
  SELECT user_1_last_active_date, user_2_last_active_date
  INTO v_u1, v_u2
  FROM public.streaks
  WHERE relationship_id = p_relationship_id;

  IF v_u1 = v_today OR v_u2 = v_today THEN
    INSERT INTO public.streak_active_days (relationship_id, activity_date)
    VALUES (p_relationship_id, v_today)
    ON CONFLICT (relationship_id, activity_date) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_streak_active_days(p_relationship_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_1 UUID;
  v_user_2 UUID;
BEGIN
  SELECT user_1_id, user_2_id INTO v_user_1, v_user_2
  FROM public.relationships
  WHERE id = p_relationship_id;

  IF v_user_1 IS NULL OR v_user_2 IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.streak_active_days (relationship_id, activity_date)
  SELECT p_relationship_id, d.activity_date
  FROM (
    SELECT activity_date
    FROM (
      SELECT (created_at AT TIME ZONE 'UTC')::date AS activity_date
      FROM public.moments
      WHERE relationship_id = p_relationship_id
      UNION
      SELECT (created_at AT TIME ZONE 'UTC')::date
      FROM public.messages
      WHERE relationship_id = p_relationship_id
      UNION
      SELECT (created_at AT TIME ZONE 'UTC')::date
      FROM public.mood_logs
      WHERE relationship_id = p_relationship_id
      UNION
      SELECT (created_at AT TIME ZONE 'UTC')::date
      FROM public.journal_entries
      WHERE relationship_id = p_relationship_id
        AND is_private = false
      UNION
      SELECT challenge_date AS activity_date
      FROM public.daily_challenges
      WHERE relationship_id = p_relationship_id
        AND (user_1_response IS NOT NULL OR user_2_response IS NOT NULL)
    ) acts
    GROUP BY activity_date
  ) d
  ON CONFLICT (relationship_id, activity_date) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_streak(
  p_relationship_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last DATE;
  v_current INT;
  v_longest INT;
  v_user_1 UUID;
  v_user_2 UUID;
  v_today DATE := CURRENT_DATE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.relationships r
    WHERE r.id = p_relationship_id
      AND r.status = 'active'
      AND r.id IN (SELECT public.user_relationship_ids())
  ) THEN
    RETURN;
  END IF;

  SELECT user_1_id, user_2_id INTO v_user_1, v_user_2
  FROM public.relationships
  WHERE id = p_relationship_id;

  IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_user_1 AND p_user_id IS DISTINCT FROM v_user_2 THEN
    RETURN;
  END IF;

  INSERT INTO public.streaks (relationship_id, current_streak, longest_streak, last_active_date)
  VALUES (p_relationship_id, 0, 0, NULL)
  ON CONFLICT (relationship_id) DO NOTHING;

  SELECT last_active_date, current_streak, longest_streak
  INTO v_last, v_current, v_longest
  FROM public.streaks
  WHERE relationship_id = p_relationship_id
  FOR UPDATE;

  IF p_user_id IS NOT NULL THEN
    IF p_user_id = v_user_1 THEN
      UPDATE public.streaks SET user_1_last_active_date = v_today WHERE relationship_id = p_relationship_id;
    ELSIF p_user_id = v_user_2 THEN
      UPDATE public.streaks SET user_2_last_active_date = v_today WHERE relationship_id = p_relationship_id;
    END IF;
  END IF;

  IF v_last IS NULL OR v_last < v_today - 1 THEN
    UPDATE public.streaks
    SET
      current_streak = 1,
      longest_streak = GREATEST(v_longest, 1),
      last_active_date = v_today,
      restorable_streak = NULL,
      restorable_lost_at = NULL,
      updated_at = NOW()
    WHERE relationship_id = p_relationship_id;
  ELSIF v_last = v_today - 1 THEN
    UPDATE public.streaks
    SET
      current_streak = v_current + 1,
      longest_streak = GREATEST(v_longest, v_current + 1),
      last_active_date = v_today,
      updated_at = NOW()
    WHERE relationship_id = p_relationship_id;
  ELSIF v_last = v_today THEN
    UPDATE public.streaks
    SET
      longest_streak = GREATEST(v_longest, v_current),
      updated_at = NOW()
    WHERE relationship_id = p_relationship_id;
  END IF;

  PERFORM public.record_streak_active_day(p_relationship_id);

  UPDATE public.relationships
  SET streak_count = (
    SELECT current_streak FROM public.streaks WHERE relationship_id = p_relationship_id
  )
  WHERE id = p_relationship_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_streak_from_daily_challenge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
BEGIN
  IF NEW.user_1_response IS NOT NULL
     AND NEW.user_2_response IS NOT NULL
     AND (OLD.user_1_response IS NULL OR OLD.user_2_response IS NULL) THEN
    UPDATE public.streaks
    SET
      user_1_last_active_date = v_today,
      user_2_last_active_date = v_today
    WHERE relationship_id = NEW.relationship_id;

    PERFORM public.update_streak(NEW.relationship_id, NULL);
  END IF;
  RETURN NEW;
END;
$$;

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
  v_can_restore BOOLEAN;
  v_active_days JSONB;
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
      'partner_active_today', false,
      'can_restore_streak', false,
      'restorable_streak', NULL,
      'restorable_lost_at', NULL,
      'active_days', '[]'::jsonb
    );
  END IF;

  v_effective := v_row.current_streak;
  v_at_risk := v_row.last_active_date = v_today - 1 AND v_effective > 0;
  v_can_restore := v_effective = 0
    AND v_row.restorable_streak IS NOT NULL
    AND v_row.restorable_streak > 0;

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

  SELECT COALESCE(
    jsonb_agg(to_char(sad.activity_date, 'YYYY-MM-DD') ORDER BY sad.activity_date),
    '[]'::jsonb
  )
  INTO v_active_days
  FROM public.streak_active_days sad
  WHERE sad.relationship_id = p_relationship_id;

  RETURN jsonb_build_object(
    'relationship_id', p_relationship_id,
    'current_streak', v_effective,
    'longest_streak', v_row.longest_streak,
    'last_active_date', v_row.last_active_date,
    'at_risk', v_at_risk,
    'both_active_today', v_both_today,
    'user_active_today', v_user_today,
    'partner_active_today', v_partner_today,
    'can_restore_streak', v_can_restore,
    'restorable_streak', v_row.restorable_streak,
    'restorable_lost_at', v_row.restorable_lost_at,
    'active_days', v_active_days
  );
END;
$$;

-- One-time backfill for existing couples.
DO $$
DECLARE
  v_rel UUID;
BEGIN
  FOR v_rel IN SELECT id FROM public.relationships WHERE status = 'active'
  LOOP
    PERFORM public.backfill_streak_active_days(v_rel);
    PERFORM public.record_streak_active_day(v_rel);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_streak_active_day(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_streak_active_days(uuid) TO authenticated;
