-- Production streaks: triggers on all qualifying activity, lazy decay, per-partner tracking.

ALTER TABLE public.streaks
  ADD COLUMN IF NOT EXISTS user_1_last_active_date DATE,
  ADD COLUMN IF NOT EXISTS user_2_last_active_date DATE;

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
    SELECT 1 FROM relationships r
    WHERE r.id = p_relationship_id
      AND r.status = 'active'
      AND r.id IN (SELECT user_relationship_ids())
  ) THEN
    RETURN;
  END IF;

  SELECT user_1_id, user_2_id INTO v_user_1, v_user_2
  FROM relationships
  WHERE id = p_relationship_id;

  IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_user_1 AND p_user_id IS DISTINCT FROM v_user_2 THEN
    RETURN;
  END IF;

  INSERT INTO streaks (relationship_id, current_streak, longest_streak, last_active_date)
  VALUES (p_relationship_id, 0, 0, NULL)
  ON CONFLICT (relationship_id) DO NOTHING;

  SELECT last_active_date, current_streak, longest_streak
  INTO v_last, v_current, v_longest
  FROM streaks
  WHERE relationship_id = p_relationship_id
  FOR UPDATE;

  IF p_user_id IS NOT NULL THEN
    IF p_user_id = v_user_1 THEN
      UPDATE streaks SET user_1_last_active_date = v_today WHERE relationship_id = p_relationship_id;
    ELSIF p_user_id = v_user_2 THEN
      UPDATE streaks SET user_2_last_active_date = v_today WHERE relationship_id = p_relationship_id;
    END IF;
  END IF;

  IF v_last IS NULL OR v_last < v_today - 1 THEN
    UPDATE streaks
    SET
      current_streak = 1,
      longest_streak = GREATEST(v_longest, 1),
      last_active_date = v_today,
      updated_at = NOW()
    WHERE relationship_id = p_relationship_id;
  ELSIF v_last = v_today - 1 THEN
    UPDATE streaks
    SET
      current_streak = v_current + 1,
      longest_streak = GREATEST(v_longest, v_current + 1),
      last_active_date = v_today,
      updated_at = NOW()
    WHERE relationship_id = p_relationship_id;
  ELSIF v_last = v_today THEN
    UPDATE streaks
    SET
      longest_streak = GREATEST(v_longest, v_current),
      updated_at = NOW()
    WHERE relationship_id = p_relationship_id;
  END IF;

  UPDATE relationships
  SET streak_count = (
    SELECT current_streak FROM streaks WHERE relationship_id = p_relationship_id
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
  v_today DATE := CURRENT_DATE;
BEGIN
  SELECT last_active_date INTO v_last
  FROM streaks
  WHERE relationship_id = p_relationship_id
  FOR UPDATE;

  IF v_last IS NOT NULL AND v_last < v_today - 1 THEN
    UPDATE streaks
    SET current_streak = 0, updated_at = NOW()
    WHERE relationship_id = p_relationship_id;

    UPDATE relationships
    SET streak_count = 0
    WHERE id = p_relationship_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_streak_status(p_relationship_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row streaks%ROWTYPE;
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
    SELECT 1 FROM relationships r
    WHERE r.id = p_relationship_id
      AND r.id IN (SELECT user_relationship_ids())
  ) THEN
    RAISE EXCEPTION 'Relationship not found';
  END IF;

  PERFORM normalize_streak_if_broken(p_relationship_id);

  SELECT user_1_id, user_2_id INTO v_user_1, v_user_2
  FROM relationships
  WHERE id = p_relationship_id;

  SELECT * INTO v_row
  FROM streaks
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

CREATE OR REPLACE FUNCTION public.trigger_streak_from_user_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM update_streak(NEW.relationship_id, NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_streak_from_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM update_streak(NEW.relationship_id, NEW.sender_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_streak_from_daily_challenge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_1_response IS NOT NULL
     AND NEW.user_2_response IS NOT NULL
     AND (OLD.user_1_response IS NULL OR OLD.user_2_response IS NULL) THEN
    PERFORM update_streak(NEW.relationship_id, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS streak_on_moment ON public.moments;
CREATE TRIGGER streak_on_moment
  AFTER INSERT ON public.moments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_streak_from_user_activity();

DROP TRIGGER IF EXISTS streak_on_message ON public.messages;
CREATE TRIGGER streak_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.trigger_streak_from_message();

DROP TRIGGER IF EXISTS streak_on_mood ON public.mood_logs;
CREATE TRIGGER streak_on_mood
  AFTER INSERT ON public.mood_logs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_streak_from_user_activity();

DROP TRIGGER IF EXISTS streak_on_journal ON public.journal_entries;
CREATE TRIGGER streak_on_journal
  AFTER INSERT ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.trigger_streak_from_user_activity();

DROP TRIGGER IF EXISTS streak_on_daily_challenge ON public.daily_challenges;
CREATE TRIGGER streak_on_daily_challenge
  AFTER UPDATE ON public.daily_challenges
  FOR EACH ROW EXECUTE FUNCTION public.trigger_streak_from_daily_challenge();

GRANT EXECUTE ON FUNCTION public.update_streak(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_streak_if_broken(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_streak_status(uuid) TO authenticated;
