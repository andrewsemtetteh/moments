-- Production-grade chat: split RLS, atomic RPCs, storage cleanup

DROP POLICY IF EXISTS messages_all ON public.messages;

CREATE POLICY messages_select ON public.messages
  FOR SELECT USING (relationship_id IN (SELECT user_relationship_ids()));

CREATE POLICY messages_insert ON public.messages
  FOR INSERT WITH CHECK (
    relationship_id IN (SELECT user_relationship_ids())
    AND sender_id = auth.uid()
  );

CREATE POLICY messages_update_sender ON public.messages
  FOR UPDATE USING (
    relationship_id IN (SELECT user_relationship_ids())
    AND sender_id = auth.uid()
  ) WITH CHECK (
    relationship_id IN (SELECT user_relationship_ids())
    AND sender_id = auth.uid()
  );

-- Mark partner messages as read (recipient only)
CREATE OR REPLACE FUNCTION public.mark_messages_read(
  p_relationship_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM relationships r
    WHERE r.id = p_relationship_id
      AND r.id IN (SELECT user_relationship_ids())
  ) THEN
    RAISE EXCEPTION 'Relationship not found';
  END IF;

  UPDATE public.messages
  SET read_at = NOW()
  WHERE relationship_id = p_relationship_id
    AND sender_id <> p_user_id
    AND read_at IS NULL;
END;
$$;

-- Atomic reaction toggle (either partner)
CREATE OR REPLACE FUNCTION public.toggle_message_reaction(
  p_message_id uuid,
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
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT m.reactions INTO reactions
  FROM public.messages m
  WHERE m.id = p_message_id
    AND m.relationship_id IN (SELECT user_relationship_ids())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
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

  UPDATE public.messages SET reactions = reactions WHERE id = p_message_id;
  RETURN reactions;
END;
$$;

-- Hide message for current user only
CREATE OR REPLACE FUNCTION public.hide_message_for_user(
  p_message_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.messages
  SET hidden_for = array_append(hidden_for, p_user_id)
  WHERE id = p_message_id
    AND relationship_id IN (SELECT user_relationship_ids())
    AND NOT (p_user_id = ANY(hidden_for));
END;
$$;

-- Pin / unpin (either partner)
CREATE OR REPLACE FUNCTION public.set_message_pinned(
  p_message_id uuid,
  p_user_id uuid,
  p_is_pinned boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.messages
  SET is_pinned = p_is_pinned
  WHERE id = p_message_id
    AND relationship_id IN (SELECT user_relationship_ids());
END;
$$;

-- Chat storage: allow relationship members to delete orphaned media
CREATE POLICY "chat_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'chat'
  AND (storage.foldername(name))[1]::uuid IN (SELECT user_relationship_ids())
);

GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_message_reaction(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hide_message_for_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_message_pinned(uuid, uuid, boolean) TO authenticated;
