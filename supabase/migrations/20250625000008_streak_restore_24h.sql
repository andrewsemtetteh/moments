-- Streak restore expires 24 hours after the streak was lost (not end-of-calendar-day).

ALTER TABLE public.streaks
  ALTER COLUMN restorable_lost_at TYPE TIMESTAMPTZ
  USING (
    CASE
      WHEN restorable_lost_at IS NULL THEN NULL
      ELSE restorable_lost_at::timestamp AT TIME ZONE 'UTC'
    END
  );

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

  IF v_last IS NOT NULL AND v_last < v_today - 1 AND v_current > 0 THEN
    PERFORM public.notify_streak_lost(p_relationship_id, v_current);

    UPDATE public.streaks
    SET
      restorable_streak = v_current,
      restorable_lost_at = NOW(),
      current_streak = 0,
      updated_at = NOW()
    WHERE relationship_id = p_relationship_id;

    UPDATE public.relationships
    SET streak_count = 0
    WHERE id = p_relationship_id;
  END IF;

  UPDATE public.streaks
  SET
    restorable_streak = NULL,
    restorable_lost_at = NULL,
    updated_at = NOW()
  WHERE relationship_id = p_relationship_id
    AND current_streak = 0
    AND restorable_lost_at IS NOT NULL
    AND restorable_lost_at <= NOW() - INTERVAL '24 hours';
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_streak(p_relationship_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restore INT;
  v_current INT;
  v_lost_at TIMESTAMPTZ;
  v_today DATE := CURRENT_DATE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.relationships r
    WHERE r.id = p_relationship_id
      AND r.id IN (SELECT public.user_relationship_ids())
  ) THEN
    RAISE EXCEPTION 'Relationship not found';
  END IF;

  IF NOT public.relationship_has_plus(p_relationship_id) THEN
    RAISE EXCEPTION 'Plus required to restore streaks';
  END IF;

  SELECT restorable_streak, current_streak, restorable_lost_at
  INTO v_restore, v_current, v_lost_at
  FROM public.streaks
  WHERE relationship_id = p_relationship_id
  FOR UPDATE;

  IF v_current <> 0 OR v_restore IS NULL OR v_restore <= 0 THEN
    RAISE EXCEPTION 'No restorable streak available';
  END IF;

  IF v_lost_at IS NULL OR v_lost_at <= NOW() - INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'Restore window expired';
  END IF;

  UPDATE public.streaks
  SET
    current_streak = v_restore,
    last_active_date = v_today - 1,
    restorable_streak = NULL,
    restorable_lost_at = NULL,
    longest_streak = GREATEST(longest_streak, v_restore),
    updated_at = NOW()
  WHERE relationship_id = p_relationship_id;

  UPDATE public.relationships
  SET streak_count = v_restore
  WHERE id = p_relationship_id;

  RETURN public.get_streak_status(p_relationship_id);
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
    AND v_row.restorable_streak > 0
    AND v_row.restorable_lost_at IS NOT NULL
    AND v_row.restorable_lost_at > NOW() - INTERVAL '24 hours';

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
    'restorable_streak', CASE WHEN v_can_restore THEN v_row.restorable_streak ELSE NULL END,
    'restorable_lost_at', CASE WHEN v_can_restore THEN v_row.restorable_lost_at ELSE NULL END,
    'active_days', v_active_days
  );
END;
$$;
