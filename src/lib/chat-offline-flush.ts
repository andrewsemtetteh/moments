import * as api from '@/services/api';

import type { ChatOfflineItem, ChatOfflinePayload } from './chat-offline-queue';

/** After this many failed tries a queued message is given up (and you're told). */
export const MAX_SEND_ATTEMPTS = 8;

/**
 * Errors that won't go away by trying again (too big, the file's gone, not allowed):
 * those messages are given up at once instead of being retried forever.
 */
export function isPermanentSendError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String((e as { message?: string } | null)?.message ?? '');
  const status = Number((e as { status?: number } | null)?.status ?? 0);
  if (status === 400 || status === 403 || status === 404 || status === 413) return true;
  return /too large|upload was empty|not allowed|forbidden|invalid path|no such file|does not exist|enoent|could not read/i.test(message);
}

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
  /** A try failed but may work later: count it. */
  onFailed: (id: string) => void;
  /** Won't ever send (permanent error, or out of tries): take it out of the queue. */
  onGiveUp: (item: ChatOfflineItem) => void;
}): Promise<{ sent: number; failed: number; givenUp: number }> {
  let sent = 0;
  let failed = 0;
  let givenUp = 0;

  for (const item of params.items) {
    if (item.type !== 'message') continue;
    try {
      const payload = item.payload;
      // Moment replies carry an already-hosted URL; only on-device media needs uploading.
      let mediaUrl: string | undefined = payload.mediaUrl;

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
    } catch (e) {
      if (isPermanentSendError(e) || (item.attempts ?? 0) + 1 >= MAX_SEND_ATTEMPTS) {
        // Out of the way, so it can't block the messages queued after it.
        params.onGiveUp(item);
        givenUp += 1;
        continue;
      }
      params.onFailed(item.id);
      failed += 1;
      // Keep the order: the rest wait for this one.
      break;
    }
  }

  return { sent, failed, givenUp };
}

export function toOfflinePayload(payload: ChatOfflinePayload): ChatOfflinePayload {
  return payload;
}
