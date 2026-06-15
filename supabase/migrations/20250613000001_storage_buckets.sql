-- Storage buckets for Moments (private, relationship-scoped paths)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('moments', 'moments', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4']),
  ('chat', 'chat', false, 20971520, ARRAY['image/jpeg', 'image/png', 'audio/mpeg', 'video/mp4']),
  ('journal', 'journal', false, 10485760, ARRAY['image/jpeg', 'image/png']),
  ('profiles', 'profiles', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can access files in their relationship folder
CREATE POLICY "moments_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'moments' AND (storage.foldername(name))[1]::uuid IN (SELECT user_relationship_ids())
);

CREATE POLICY "moments_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'moments' AND (storage.foldername(name))[1]::uuid IN (SELECT user_relationship_ids())
);

CREATE POLICY "chat_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'chat' AND (storage.foldername(name))[1]::uuid IN (SELECT user_relationship_ids())
);

CREATE POLICY "chat_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'chat' AND (storage.foldername(name))[1]::uuid IN (SELECT user_relationship_ids())
);

CREATE POLICY "profiles_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "profiles_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "profiles_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]
);
