-- Allow users to delete their own moment files from storage.
CREATE POLICY "moments_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'moments'
  AND (storage.foldername(name))[1]::uuid IN (SELECT user_relationship_ids())
  AND (storage.foldername(name))[2] = auth.uid()::text
);
