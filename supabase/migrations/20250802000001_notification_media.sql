-- Optional media / entity link for moment notification thumbnails.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS related_id UUID;

CREATE OR REPLACE FUNCTION public.create_partner_notification(
  p_relationship_id UUID,
  p_recipient_id UUID,
  p_type TEXT,
  p_content TEXT,
  p_media_url TEXT DEFAULT NULL,
  p_related_id UUID DEFAULT NULL
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

  INSERT INTO public.notifications (relationship_id, user_id, type, content, media_url, related_id)
  VALUES (
    p_relationship_id,
    p_recipient_id,
    p_type,
    p_content,
    NULLIF(btrim(COALESCE(p_media_url, '')), ''),
    p_related_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_partner_notification(uuid, uuid, text, text, text, uuid) TO authenticated;
