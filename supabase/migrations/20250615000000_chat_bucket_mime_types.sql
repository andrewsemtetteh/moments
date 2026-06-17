-- Expand chat bucket mime types for voice notes, videos, and file attachments.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'video/mp4',
  'video/quicktime',
  'application/pdf',
  'application/octet-stream'
]
WHERE id = 'chat';
