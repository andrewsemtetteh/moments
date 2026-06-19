import * as api from '@/services/api';
import { enrichMomentWithAuthor } from '@/lib/moment-display';
import type { Moment, MomentType, UserProfile } from '@/types/database';

export interface MomentReplyContext {
  momentId: string;
  mediaUrl: string | null;
  momentType: MomentType;
}

export function momentToReplyContext(moment: Moment): MomentReplyContext {
  return {
    momentId: moment.id,
    mediaUrl: moment.media_url,
    momentType: moment.type,
  };
}

export function isMomentReplyMessage(message: { moment_id?: string | null }): boolean {
  return !!message.moment_id;
}

export async function resolveMomentForReply(
  momentId: string,
  user?: Pick<UserProfile, 'id' | 'name' | 'email' | 'avatar_url'> | null,
  partner?: Pick<UserProfile, 'id' | 'name' | 'email' | 'avatar_url'> | null,
): Promise<Moment | null> {
  const remote = await api.fetchMomentById(momentId).catch(() => null);
  if (!remote) return null;
  return enrichMomentWithAuthor(remote, user, partner);
}
