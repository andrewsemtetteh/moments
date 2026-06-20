-- Plus-only streak restore: save count when a streak breaks, offer restore only while
-- current_streak = 0 and no new streak has started (cleared on first new activity).

ALTER TABLE public.streaks
  ADD COLUMN IF NOT EXISTS restorable_streak INT,
  ADD COLUMN IF NOT EXISTS restorable_lost_at DATE;

CREATE OR REPLACE FUNCTION public.relationship_has_plus(p_relationship_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT r.subscription_tier = 'plus' AND r.subscription_owner_id IS NOT NULL
      FROM public.relationships r
      WHERE r.id = p_relationship_id
        AND r.status = 'active'
    ),
    FALSE
  );
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

  -- Starting a brand-new streak clears any pending restore window.
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

  UPDATE public.relationships
  SET streak_count = (
    SELECT current_streak FROM public.streaks WHERE relationship_id = p_relationship_id
  )
  WHERE id = p_relationship_id;
END;
$$;

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
    SET
      restorable_streak = CASE WHEN v_current > 0 THEN v_current ELSE restorable_streak END,
      restorable_lost_at = CASE WHEN v_current > 0 THEN v_today ELSE restorable_lost_at END,
      current_streak = 0,
      updated_at = NOW()
    WHERE relationship_id = p_relationship_id;

    UPDATE public.relationships
    SET streak_count = 0
    WHERE id = p_relationship_id;
  END IF;
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

  SELECT restorable_streak, current_streak
  INTO v_restore, v_current
  FROM public.streaks
  WHERE relationship_id = p_relationship_id
  FOR UPDATE;

  IF v_current <> 0 OR v_restore IS NULL OR v_restore <= 0 THEN
    RAISE EXCEPTION 'No restorable streak available';
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
      'restorable_lost_at', NULL
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
    'restorable_lost_at', v_row.restorable_lost_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_streak(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.relationship_has_plus(uuid) TO authenticated;

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
  v_message TEXT;
BEGIN
  IF p_previous_streak IS NULL OR p_previous_streak <= 0 THEN
    RETURN;
  END IF;

  v_dedup := 'streak_lost:' || to_char(CURRENT_DATE, 'YYYY-MM-DD');
  IF NOT public.try_notification_dedup(p_relationship_id, v_dedup) THEN
    RETURN;
  END IF;

  v_message := 'Your ' || p_previous_streak
    || '-day streak ended. Plus members can restore it before starting over.';

  SELECT user_1_id, user_2_id INTO v_user_1, v_user_2
  FROM public.relationships
  WHERE id = p_relationship_id;

  IF v_user_1 IS NOT NULL THEN
    PERFORM public.create_partner_notification(
      p_relationship_id,
      v_user_1,
      'streak',
      v_message
    );
  END IF;

  IF v_user_2 IS NOT NULL THEN
    PERFORM public.create_partner_notification(
      p_relationship_id,
      v_user_2,
      'streak',
      v_message
    );
  END IF;
END;
$$;
