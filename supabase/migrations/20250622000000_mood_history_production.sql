-- Mood history production RPCs: paginated timeline + server-side aggregates.

CREATE OR REPLACE FUNCTION public.get_mood_history_page(
  p_relationship_id UUID,
  p_limit INT DEFAULT 50,
  p_before TIMESTAMPTZ DEFAULT NULL,
  p_filter_user_id UUID DEFAULT NULL
)
RETURNS SETOF public.mood_logs
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT m.*
  FROM public.mood_logs m
  WHERE m.relationship_id = p_relationship_id
    AND m.relationship_id IN (SELECT public.user_relationship_ids())
    AND (p_filter_user_id IS NULL OR m.user_id = p_filter_user_id)
    AND (p_before IS NULL OR m.created_at < p_before)
  ORDER BY m.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
$$;

CREATE OR REPLACE FUNCTION public.get_mood_history_overview(
  p_relationship_id UUID,
  p_filter_user_id UUID DEFAULT NULL,
  p_days INT DEFAULT 14,
  p_weeks INT DEFAULT 8,
  p_offset_minutes INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_days INT := LEAST(GREATEST(COALESCE(p_days, 14), 1), 90);
  v_weeks INT := LEAST(GREATEST(COALESCE(p_weeks, 8), 1), 52);
  v_total INT;
  v_top_mood TEXT;
  v_top_count INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.relationships r
    WHERE r.id = p_relationship_id
      AND r.id IN (SELECT public.user_relationship_ids())
  ) THEN
    RAISE EXCEPTION 'Relationship not found';
  END IF;

  SELECT COUNT(*)::INT
  INTO v_total
  FROM public.mood_logs m
  WHERE m.relationship_id = p_relationship_id
    AND (p_filter_user_id IS NULL OR m.user_id = p_filter_user_id);

  SELECT c.mood::TEXT, c.cnt::INT
  INTO v_top_mood, v_top_count
  FROM (
    SELECT m.mood, COUNT(*) AS cnt
    FROM public.mood_logs m
    WHERE m.relationship_id = p_relationship_id
      AND (p_filter_user_id IS NULL OR m.user_id = p_filter_user_id)
    GROUP BY m.mood
    ORDER BY cnt DESC, m.mood
    LIMIT 1
  ) c;

  RETURN jsonb_build_object(
    'summary', jsonb_build_object(
      'total', COALESCE(v_total, 0),
      'top_mood', v_top_mood,
      'top_mood_count', COALESCE(v_top_count, 0)
    ),
    'counts', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('mood', mood::TEXT, 'log_count', cnt)
        ORDER BY cnt DESC, mood
      )
      FROM (
        SELECT m.mood, COUNT(*)::INT AS cnt
        FROM public.mood_logs m
        WHERE m.relationship_id = p_relationship_id
          AND (p_filter_user_id IS NULL OR m.user_id = p_filter_user_id)
        GROUP BY m.mood
        ORDER BY cnt DESC, mood
        LIMIT 20
      ) mood_counts
    ), '[]'::jsonb),
    'daily', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'day_date', d.day_date,
          'log_count', COALESCE(dc.log_count, 0),
          'dominant_mood', dc.dominant_mood
        )
        ORDER BY d.day_date
      )
      FROM (
        SELECT (
          (
            (CURRENT_TIMESTAMP + (p_offset_minutes || ' minutes')::interval)::DATE
          )
          - ((v_days - 1 - gs.i) || ' days')::interval
        )::DATE AS day_date
        FROM generate_series(0, v_days - 1) AS gs(i)
      ) d
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::INT AS log_count,
          (
            SELECT dm.mood::TEXT
            FROM (
              SELECT m2.mood, COUNT(*) AS c
              FROM public.mood_logs m2
              WHERE m2.relationship_id = p_relationship_id
                AND (p_filter_user_id IS NULL OR m2.user_id = p_filter_user_id)
                AND (
                  (m2.created_at + (p_offset_minutes || ' minutes')::interval)::DATE
                ) = d.day_date
              GROUP BY m2.mood
              ORDER BY c DESC, m2.mood
              LIMIT 1
            ) dm
          ) AS dominant_mood
        FROM public.mood_logs m
        WHERE m.relationship_id = p_relationship_id
          AND (p_filter_user_id IS NULL OR m.user_id = p_filter_user_id)
          AND (
            (m.created_at + (p_offset_minutes || ' minutes')::interval)::DATE
          ) = d.day_date
      ) dc ON TRUE
    ), '[]'::jsonb),
    'weekly', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'week_start', w.week_start,
          'user_id', w.user_id,
          'log_count', w.log_count,
          'top_mood', w.top_mood
        )
        ORDER BY w.week_start, w.user_id
      )
      FROM (
        SELECT
          (
            date_trunc(
              'week',
              (m.created_at + (p_offset_minutes || ' minutes')::interval)
            )
          )::DATE AS week_start,
          m.user_id,
          COUNT(*)::INT AS log_count,
          (
            SELECT tm.mood::TEXT
            FROM public.mood_logs tm
            WHERE tm.relationship_id = p_relationship_id
              AND (p_filter_user_id IS NULL OR tm.user_id = p_filter_user_id)
              AND tm.user_id = m.user_id
              AND date_trunc(
                'week',
                (tm.created_at + (p_offset_minutes || ' minutes')::interval)
              ) = date_trunc(
                'week',
                (m.created_at + (p_offset_minutes || ' minutes')::interval)
              )
            GROUP BY tm.mood
            ORDER BY COUNT(*) DESC, tm.mood
            LIMIT 1
          ) AS top_mood
        FROM public.mood_logs m
        WHERE m.relationship_id = p_relationship_id
          AND (p_filter_user_id IS NULL OR m.user_id = p_filter_user_id)
          AND (
            (m.created_at + (p_offset_minutes || ' minutes')::interval)
          ) >= (
            date_trunc(
              'week',
              (CURRENT_TIMESTAMP + (p_offset_minutes || ' minutes')::interval)
            )
            - ((v_weeks - 1) || ' weeks')::interval
          )
        GROUP BY week_start, m.user_id
      ) w
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mood_history_page(UUID, INT, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mood_history_overview(UUID, UUID, INT, INT, INT) TO authenticated;
