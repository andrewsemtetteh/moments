import type { Message } from '@/types/database';

export function getMessagePreviewText(message: Pick<Message, 'content' | 'media_type' | 'deleted_for_all'>): string {
  if (message.deleted_for_all) return 'This message was deleted';
  if (message.media_type === 'voice') return 'Voice message';
  if (message.media_type === 'image') return 'Photo';
  if (message.media_type === 'video') return 'Video';
  return message.content?.trim() || 'Message';
}
