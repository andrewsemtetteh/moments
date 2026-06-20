-- Shared album: dedicated couple media storage (iOS Shared Album style)
CREATE TABLE IF NOT EXISTS public.shared_album_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (file_size_bytes >= 0),
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_album_items_relationship
  ON public.shared_album_items(relationship_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shared_album_items_user
  ON public.shared_album_items(user_id);

ALTER TABLE public.shared_album_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY shared_album_items_select ON public.shared_album_items
  FOR SELECT USING (relationship_id IN (SELECT user_relationship_ids()));

CREATE POLICY shared_album_items_insert ON public.shared_album_items
  FOR INSERT WITH CHECK (
    relationship_id IN (SELECT user_relationship_ids())
    AND user_id = auth.uid()
  );

CREATE POLICY shared_album_items_update ON public.shared_album_items
  FOR UPDATE USING (
    relationship_id IN (SELECT user_relationship_ids())
    AND user_id = auth.uid()
  );

CREATE POLICY shared_album_items_delete ON public.shared_album_items
  FOR DELETE USING (
    relationship_id IN (SELECT user_relationship_ids())
    AND user_id = auth.uid()
  );

-- Private storage bucket for shared album media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shared-album',
  'shared-album',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "shared_album_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'shared-album'
  AND (storage.foldername(name))[1]::uuid IN (SELECT user_relationship_ids())
);

CREATE POLICY "shared_album_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'shared-album'
  AND (storage.foldername(name))[1]::uuid IN (SELECT user_relationship_ids())
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "shared_album_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'shared-album'
  AND (storage.foldername(name))[1]::uuid IN (SELECT user_relationship_ids())
  AND (storage.foldername(name))[2] = auth.uid()::text
);

ALTER PUBLICATION supabase_realtime ADD TABLE shared_album_items;
