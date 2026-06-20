/** Extract `{relationshipId}/{filename}` from a Supabase chat storage URL. */
export function extractChatStoragePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = '/chat/';
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  let path = url.slice(idx + marker.length);
  const q = path.indexOf('?');
  if (q >= 0) path = path.slice(0, q);
  return decodeURIComponent(path);
}

export function messagePreviewLabel(message: {
  content: string | null;
  media_type: 'image' | 'voice' | 'video' | null;
  deleted_for_all?: boolean;
}): string {
  if (message.deleted_for_all) return 'Deleted message';
  const text = message.content?.trim();
  if (text) return text.length > 120 ? `${text.slice(0, 117)}…` : text;
  if (message.media_type === 'image') return 'Photo';
  if (message.media_type === 'video') return 'Video';
  if (message.media_type === 'voice') return 'Voice message';
  return 'Message';
}
