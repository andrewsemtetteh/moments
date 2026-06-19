-- Moments bucket: allow video and larger files (match chat video support).
UPDATE storage.buckets
SET
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'audio/mpeg',
    'audio/mp4',
    'video/mp4',
    'video/quicktime'
  ]
WHERE id = 'moments';

-- Track which users have opened a moment (for unseen story rings).
ALTER TABLE public.moments
  ADD COLUMN IF NOT EXISTS viewed_by TEXT[] NOT NULL DEFAULT '{}';

-- Atomic reaction toggle (avoids read-modify-write races).
CREATE OR REPLACE FUNCTION public.toggle_moment_reaction(
  p_moment_id uuid,
  p_user_id uuid,
  p_emoji text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reactions jsonb;
  had_emoji boolean;
  user_text text := p_user_id::text;
  cleaned jsonb;
BEGIN
  SELECT m.reactions INTO reactions
  FROM moments m
  WHERE m.id = p_moment_id
    AND m.relationship_id IN (SELECT user_relationship_ids())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Moment not found';
  END IF;

  reactions := COALESCE(reactions, '{}'::jsonb);
  had_emoji := COALESCE((reactions -> p_emoji) ? user_text, false);

  SELECT COALESCE(jsonb_object_agg(s.key, s.filtered), '{}'::jsonb)
  INTO cleaned
  FROM (
    SELECT e.key,
      (
        SELECT COALESCE(jsonb_agg(to_jsonb(u)), '[]'::jsonb)
        FROM jsonb_array_elements_text(e.value) AS u
        WHERE u <> user_text
      ) AS filtered
    FROM jsonb_each(reactions) AS e(key, value)
  ) s
  WHERE jsonb_array_length(s.filtered) > 0;

  reactions := cleaned;

  IF NOT had_emoji THEN
    reactions := jsonb_set(
      reactions,
      ARRAY[p_emoji],
      COALESCE(reactions -> p_emoji, '[]'::jsonb) || to_jsonb(user_text),
      true
    );
  END IF;

  UPDATE moments SET reactions = reactions WHERE id = p_moment_id;
  RETURN reactions;
END;
$$;
