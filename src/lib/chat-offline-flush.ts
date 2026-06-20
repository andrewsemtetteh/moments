import * as api from '@/services/api';

import type { ChatOfflineItem, ChatOfflinePayload } from './chat-offline-queue';

function mediaUploadMeta(mediaType: string, uri: string) {
  if (mediaType === 'video') {
    return { ext: 'mp4', contentType: 'video/mp4' };
  }
  if (mediaType === 'voice') {
    return { ext: 'm4a', contentType: 'audio/mp4' };
  }
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext === 'png') return { ext: 'png', contentType: 'image/png' };
  if (ext === 'webp') return { ext: 'webp', contentType: 'image/webp' };
  return { ext: 'jpg', contentType: 'image/jpeg' };
}

export async function flushChatOfflineQueue(params: {
  relationshipId: string;
  userId: string;
  items: ChatOfflineItem[];
  partnerUserId?: string | null;
  senderName?: string | null;
  onSent: (id: string) => void;
}): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const item of params.items) {
    if (item.type !== 'message') continue;
    try {
      const payload = item.payload;
      let mediaUrl: string | undefined;

      if (payload.mediaLocalUri && payload.mediaType) {
        const { ext, contentType } = mediaUploadMeta(payload.mediaType, payload.mediaLocalUri);
        const path = `${params.relationshipId}/${params.userId}-${Date.now()}.${ext}`;
        mediaUrl = await api.uploadChatMedia(path, payload.mediaLocalUri, contentType);
      }

      await api.sendMessage(
        params.relationshipId,
        params.userId,
        payload.content,
        mediaUrl,
        payload.mediaType,
        payload.momentId,
        payload.replyToId,
        { partnerUserId: params.partnerUserId, senderName: params.senderName },
      );
      params.onSent(item.id);
      sent += 1;
    } catch {
      failed += 1;
      break;
    }
  }

  return { sent, failed };
}

export function toOfflinePayload(payload: ChatOfflinePayload): ChatOfflinePayload {
  return payload;
}
