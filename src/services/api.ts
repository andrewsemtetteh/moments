import { FREE_ALBUM_STORAGE_BYTES } from '@/constants/design-system';
import { isValidAnniversaryIso } from '@/lib/anniversary';
import { extractChatStoragePath } from '@/lib/chat-media';
import { challengeResponseField } from '@/lib/daily-prompt';
import { localCalendarDate } from '@/lib/db-time';
import { extractMomentsStoragePath, hydrateMomentsMedia } from '@/lib/moment-media';
import {
    buildOverviewFromLogs,
    getLocalTimezoneOffsetMinutes,
    mapRpcOverview,
    resolveMoodFilterUserId,
    type MoodHistoryFilter,
    type RpcMoodHistoryOverview,
} from '@/lib/mood-history';
import { getErrorMessage, isMissingColumnError, isMissingTableError, isNoRowsUpdatedError, isRpcNotFoundError, toUserFacingNetworkError } from '@/lib/network-error';
import {
    clientFallbackQuestions,
    computeRoundPoints,
    mergeScores,
    parseQuizQuestions,
} from '@/lib/quiz-live';
import { SharedAlbumStorageLimitError } from '@/lib/shared-album';
import { hydrateSharedAlbumItems } from '@/lib/shared-album-media';
import { createStorageSignedUrl } from '@/lib/storage-cdn';
import { legacyStreakToStatus, parseStreakStatus, withEffectiveStreakRestore } from '@/lib/streak';
import { hasActiveUserSubscription } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import type {
    Activity,
    BucketListItem,
    CalendarEvent,
    DailyChallenge,
    Message,
    Moment,
    MoodLog,
    Notification,
    QuizLiveQuestion,
    QuizLiveSession,
    Relationship,
    RelationshipType,
    SharedAlbumItem,
    SharedGoal,
    Streak,
    StreakStatus,
    StreamingConnection,
    SubscriptionTier,
    UserProfile,
    WatchHistoryEntry,
    WatchlistItem,
    WatchMessage,
    WatchReaction,
    WatchSession,
    WatchVote,
} from '@/types/database';
import { format, startOfDay } from 'date-fns';
import * as Crypto from 'expo-crypto';

async function readUriAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function pickPrimaryRelationship(relationships: Relationship[], userId: string): Relationship | null {
  if (relationships.length === 0) return null;

  const score = (rel: Relationship) => {
    if (rel.status === 'active' && rel.user_1_id && rel.user_2_id) return 400;
    if (rel.status === 'pending' && rel.user_2_id) return 300;
    if (rel.status === 'pending' && rel.user_1_id === userId && !rel.user_2_id) return 200;
    return 100;
  };

  return [...relationships].sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  })[0];
}

export async function fetchPartnerProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  if (!error && data) return data as UserProfile;

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_partner_profile', {
    p_user_id: userId,
  });
  if (rpcError || !rpcData) return null;
  return rpcData as UserProfile;
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  if (error) return null;
  return data;
}

export async function createProfile(profile: Pick<UserProfile, 'id' | 'email' | 'name'>) {
  const { data, error } = await supabase
    .from('users')
    .insert({
      id: profile.id,
      email: profile.email,
      name: profile.name,
    })
    .select()
    .single();
  if (error) throw error;
  return data as UserProfile;
}

export async function updateProfile(userId: string, updates: Partial<UserProfile>) {
  const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select().single();
  if (error) {
    throwSaveError(error, 'Could not save. Please try again.', 'gender');
  }
  return data;
}

export async function updateLocationSharing(
  userId: string,
  enabled: boolean,
  place?: { latitude: number; longitude: number; label: string },
) {
  const updates: Partial<UserProfile> = enabled && place
    ? {
        location_sharing_enabled: true,
        location_latitude: place.latitude,
        location_longitude: place.longitude,
        location_label: place.label,
        location_updated_at: new Date().toISOString(),
      }
    : {
        location_sharing_enabled: false,
        location_latitude: null,
        location_longitude: null,
        location_label: null,
        location_updated_at: null,
      };
  return updateProfile(userId, updates);
}

export async function updateOnlineStatusVisibility(userId: string, enabled: boolean) {
  const updates: Partial<UserProfile> = {
    show_online_status: enabled,
    ...(enabled ? {} : { last_seen_at: new Date().toISOString() }),
  };
  return updateProfile(userId, updates);
}

/** Throttled by callers — keeps partner "last seen" accurate when online. */
export async function touchLastSeen(userId: string) {
  return updateProfile(userId, { last_seen_at: new Date().toISOString() });
}

export async function fetchRelationship(userId: string): Promise<{
  relationship: Relationship | null;
  partner: UserProfile | null;
}> {
  const { data: relationships, error } = await supabase
    .from('relationships')
    .select('*')
    .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
    .neq('status', 'ended')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !relationships?.length) return { relationship: null, partner: null };

  const relationship = pickPrimaryRelationship(relationships as Relationship[], userId);
  if (!relationship) return { relationship: null, partner: null };

  const partnerId =
    relationship.user_1_id === userId ? relationship.user_2_id : relationship.user_1_id;

  let partner: UserProfile | null = null;
  if (partnerId) {
    partner = await fetchPartnerProfile(partnerId);
  }

  return { relationship, partner };
}

/** Apply the first member with an active personal subscription as this space's Plus owner. */
async function syncRelationshipSubscription(
  relationship: Relationship,
  memberIds: string[],
): Promise<Relationship> {
  for (const memberId of memberIds) {
    const profile = await fetchProfile(memberId);
    if (profile && hasActiveUserSubscription(profile)) {
      return updateRelationship(relationship.id, {
        subscription_owner_id: memberId,
        subscription_tier: (profile.subscription_tier ?? 'plus') as SubscriptionTier,
      });
    }
  }

  if (relationship.subscription_owner_id || (relationship.subscription_tier ?? 'free') !== 'free') {
    return updateRelationship(relationship.id, {
      subscription_owner_id: null,
      subscription_tier: 'free',
    });
  }

  return relationship;
}

/** Update a user's personal subscription (RevenueCat webhook / purchase flow). */
export async function setUserSubscription(
  userId: string,
  params: {
    tier: SubscriptionTier;
    expires_at?: string | null;
    revenuecat_customer_id?: string | null;
    revenuecat_subscription_id?: string | null;
  },
): Promise<{ profile: UserProfile; relationship: Relationship | null }> {
  const profile = await updateProfile(userId, {
    subscription_tier: params.tier,
    subscription_expires_at: params.expires_at ?? null,
    revenuecat_customer_id: params.revenuecat_customer_id ?? null,
    revenuecat_subscription_id: params.revenuecat_subscription_id ?? null,
  });

  const { relationship } = await fetchRelationship(userId);
  if (relationship && relationship.status !== 'ended') {
    const memberIds = [relationship.user_1_id, relationship.user_2_id].filter(Boolean) as string[];
    const synced = await syncRelationshipSubscription(relationship, memberIds);
    return { profile, relationship: synced };
  }

  return { profile, relationship };
}

export async function createRelationship(
  userId: string,
  name: string,
  options?: { anniversaryDate?: string | null; relationshipType?: RelationshipType | null },
) {
  const inviteCode = generateInviteCode();
  const anniversaryDate = options?.anniversaryDate;
  const relationshipType = options?.relationshipType;
  const { data, error } = await supabase
    .from('relationships')
    .insert({
      user_1_id: userId,
      relationship_name: name,
      invite_code: inviteCode,
      status: 'pending',
      ...(anniversaryDate ? { anniversary_date: anniversaryDate } : {}),
      ...(relationshipType ? { relationship_type: relationshipType } : {}),
    })
    .select()
    .single();
  if (error) throw error;

  await supabase.from('streaks').insert({ relationship_id: data.id });
  return syncRelationshipSubscription(data as Relationship, [userId]);
}

/** Ends pending solo spaces (creator waiting alone) so the user can join a partner's space. */
export async function endEmptySoloRelationships(userId: string): Promise<void> {
  const { data: soloSpaces, error } = await supabase
    .from('relationships')
    .select('id')
    .eq('user_1_id', userId)
    .is('user_2_id', null)
    .eq('status', 'pending');

  if (error || !soloSpaces?.length) return;

  await Promise.all(soloSpaces.map((rel) => leaveRelationship(userId, rel.id)));
}

function normalizeInviteCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
}

function mapJoinError(error: { message?: string; details?: string }): Error {
  const message = error.message ?? error.details ?? 'Please check the code and try again.';
  if (message.includes('Invalid or expired invite code')) {
    return new Error('Invalid or expired invite code');
  }
  if (message.includes('your own code')) {
    return new Error("That's your own code. Share it with your partner, or enter their code instead.");
  }
  return new Error(message);
}

export type JoinRelationshipResult = {
  relationship: Relationship;
  partner: UserProfile | null;
};

export async function joinRelationship(userId: string, inviteCode: string): Promise<JoinRelationshipResult> {
  const normalizedCode = normalizeInviteCode(inviteCode);

  if (normalizedCode.length < 6) {
    throw new Error('Invalid or expired invite code');
  }

  const { data, error } = await supabase.rpc('join_relationship_by_invite', {
    p_invite_code: normalizedCode,
  });

  if (error) throw mapJoinError(error);

  const rel = data as Relationship | null;
  if (!rel) throw new Error('Invalid or expired invite code');

  const relationship = await syncRelationshipSubscription(rel, [rel.user_1_id, userId]);
  const partnerId =
    relationship.user_1_id === userId ? relationship.user_2_id : relationship.user_1_id;
  const partner = partnerId ? await fetchPartnerProfile(partnerId) : null;

  return { relationship, partner };
}
export async function ensureInviteCode(relationshipId: string): Promise<Relationship> {
  const { data: rel, error } = await supabase
    .from('relationships')
    .select('*')
    .eq('id', relationshipId)
    .single();

  if (error || !rel) throw new Error('Relationship not found');
  if (rel.user_2_id) return rel as Relationship;
  if (rel.invite_code) return rel as Relationship;

  const inviteCode = generateInviteCode();
  return updateRelationship(relationshipId, { invite_code: inviteCode });
}

/** End a relationship for both partners. Either member can leave. */
export async function leaveRelationship(userId: string, relationshipId: string): Promise<Relationship> {
  const { data: rel, error: fetchError } = await supabase
    .from('relationships')
    .select('*')
    .eq('id', relationshipId)
    .single();

  if (fetchError || !rel) throw new Error('Relationship not found');
  if (rel.user_1_id !== userId && rel.user_2_id !== userId) {
    throw new Error('You are not part of this relationship');
  }
  if (rel.status === 'ended') return rel as Relationship;

  return updateRelationship(relationshipId, {
    status: 'ended',
    invite_code: null,
    subscription_tier: 'free',
    subscription_owner_id: null,
  });
}

export async function fetchMoments(relationshipId: string, limit = 30, cursor?: string) {
  let query = supabase
    .from('moments')
    .select('*')
    .eq('relationship_id', relationshipId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) throw error;
  return hydrateMomentsMedia(data as Moment[]);
}

export async function createMoment(
  relationshipId: string,
  userId: string,
  moment: {
    type: 'photo' | 'video';
    media_url: string;
  },
  options?: { senderName?: string | null; partnerUserId?: string | null },
) {
  const { data, error } = await supabase.rpc('create_moment', {
    p_relationship_id: relationshipId,
    p_type: moment.type,
    p_media_url: moment.media_url,
    p_content: null,
  });
  if (error) throw error;
  if (!data) throw new Error('Could not create moment');

  const partnerId = options?.partnerUserId;
  if (partnerId && partnerId !== userId) {
    const label = options?.senderName?.split(' ')[0] ?? 'Your partner';
    const created = data as Moment;
    await sendPartnerNotification(
      relationshipId,
      partnerId,
      'moment',
      `${label} sent you a new moment`,
      { mediaUrl: created.media_url ?? moment.media_url, relatedId: created.id },
    );
  }

  return data as Moment;
}

export async function fetchMomentById(momentId: string) {
  const { data, error } = await supabase.from('moments').select('*').eq('id', momentId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [hydrated] = await hydrateMomentsMedia([data as Moment]);
  return hydrated;
}

export async function markMomentViewed(momentId: string, _userId: string) {
  const { error } = await supabase.rpc('mark_moment_viewed', {
    p_moment_id: momentId,
  });
  if (error) throw error;
}

export async function deleteMoment(momentId: string, userId: string) {
  const { data: moment, error: fetchError } = await supabase
    .from('moments')
    .select('id, user_id, media_url')
    .eq('id', momentId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!moment) return;
  if (moment.user_id !== userId) {
    throw new Error('You can only delete moments you sent.');
  }

  const path = extractMomentsStoragePath(moment.media_url);
  if (path) {
    await supabase.storage.from('moments').remove([path]);
  }

  const { error } = await supabase.from('moments').delete().eq('id', momentId);
  if (error) throw error;
}

export async function deleteMoments(momentIds: string[], userId: string) {
  if (momentIds.length === 0) return { deleted: 0, skipped: 0 };

  const { data: rows, error: fetchError } = await supabase
    .from('moments')
    .select('id, user_id, media_url')
    .in('id', momentIds);
  if (fetchError) throw fetchError;

  const owned = (rows ?? []).filter((m) => m.user_id === userId);
  const skipped = momentIds.length - owned.length;

  if (owned.length === 0) {
    throw new Error('You can only delete moments you sent.');
  }

  const paths = owned
    .map((m) => extractMomentsStoragePath(m.media_url))
    .filter((p): p is string => !!p);

  if (paths.length > 0) {
    await supabase.storage.from('moments').remove(paths);
  }

  const { error } = await supabase.from('moments').delete().in(
    'id',
    owned.map((m) => m.id),
  );
  if (error) throw error;

  return { deleted: owned.length, skipped };
}

export async function fetchSharedAlbumItems(relationshipId: string) {
  const { data, error } = await supabase
    .from('shared_album_items')
    .select('*')
    .eq('relationship_id', relationshipId)
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return hydrateSharedAlbumItems((data ?? []) as SharedAlbumItem[]);
}

export async function fetchSharedAlbumStorageUsed(relationshipId: string): Promise<number> {
  const { data, error } = await supabase
    .from('shared_album_items')
    .select('file_size_bytes')
    .eq('relationship_id', relationshipId);
  if (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }
  return (data ?? []).reduce((sum, row) => sum + Number(row.file_size_bytes ?? 0), 0);
}

export async function uploadSharedAlbumMedia(path: string, uri: string, contentType: string) {
  const arrayBuffer = await readUriAsArrayBuffer(uri);

  const { data, error } = await supabase.storage.from('shared-album').upload(path, arrayBuffer, {
    contentType,
    upsert: false,
  });
  if (error) throw error;

  const signedUrl = await createStorageSignedUrl('shared-album', data.path, { size: 'full' });
  return { path: data.path, signedUrl, byteLength: arrayBuffer.byteLength };
}

export async function createSharedAlbumItem(
  relationshipId: string,
  userId: string,
  payload: {
    uri: string;
    mediaType: 'photo' | 'video';
    fileSizeBytes?: number;
    caption?: string | null;
  },
  options?: { isPlus?: boolean },
) {
  const isPlus = options?.isPlus ?? false;
  const limitBytes = isPlus ? Number.POSITIVE_INFINITY : FREE_ALBUM_STORAGE_BYTES;

  const arrayBuffer = await readUriAsArrayBuffer(payload.uri);
  const byteLength =
    payload.fileSizeBytes && payload.fileSizeBytes > 0 ? payload.fileSizeBytes : arrayBuffer.byteLength;

  const usedBytes = await fetchSharedAlbumStorageUsed(relationshipId);
  if (!isPlus && usedBytes + byteLength > limitBytes) {
    throw new SharedAlbumStorageLimitError(usedBytes, limitBytes, byteLength);
  }

  const ext = payload.mediaType === 'video' ? 'mp4' : 'jpg';
  const fileName = `${Crypto.randomUUID()}.${ext}`;
  const storagePath = `${relationshipId}/${userId}/${fileName}`;
  const contentType = payload.mediaType === 'video' ? 'video/mp4' : 'image/jpeg';

  const { path } = await uploadSharedAlbumMedia(storagePath, payload.uri, contentType);

  const { data, error } = await supabase
    .from('shared_album_items')
    .insert({
      relationship_id: relationshipId,
      user_id: userId,
      media_type: payload.mediaType,
      storage_path: path,
      file_size_bytes: byteLength,
      caption: payload.caption?.trim() || null,
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from('shared-album').remove([path]);
    throw error;
  }

  const [hydrated] = await hydrateSharedAlbumItems([data as SharedAlbumItem]);
  return hydrated;
}

export async function deleteSharedAlbumItem(itemId: string, userId: string) {
  const { data: item, error: fetchError } = await supabase
    .from('shared_album_items')
    .select('id, user_id, storage_path')
    .eq('id', itemId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!item) return;
  if (item.user_id !== userId) {
    throw new Error('You can only remove media you added.');
  }

  await supabase.storage.from('shared-album').remove([item.storage_path]);

  const { error } = await supabase.from('shared_album_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function fetchMessages(relationshipId: string, limit = 50, cursor?: string) {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('relationship_id', relationshipId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) throw error;
  return (data as Message[])
    .reverse()
    .map((message) => ({
      ...message,
      reply_to_id: message.reply_to_id ?? null,
      deleted_for_all: message.deleted_for_all ?? false,
      hidden_for: message.hidden_for ?? [],
    }));
}

export async function sendMessage(
  relationshipId: string,
  senderId: string,
  content: string,
  mediaUrl?: string,
  mediaType?: string,
  momentId?: string,
  replyToId?: string,
  options?: { partnerUserId?: string | null; senderName?: string | null },
) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      relationship_id: relationshipId,
      sender_id: senderId,
      content,
      media_url: mediaUrl,
      media_type: mediaType,
      moment_id: momentId ?? null,
      reply_to_id: replyToId ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  return data as Message;
}

export async function markMessagesRead(relationshipId: string, userId: string) {
  const { error } = await supabase.rpc('mark_messages_read', {
    p_relationship_id: relationshipId,
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function fetchUnreadMessageCount(relationshipId: string, userId: string) {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('relationship_id', relationshipId)
    .neq('sender_id', userId)
    .is('read_at', null)
    .not('deleted_for_all', 'eq', true);

  if (error) throw error;
  return count ?? 0;
}

export async function fetchLatestMessage(
  relationshipId: string,
  userId: string,
): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('relationship_id', relationshipId)
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) throw error;

  const latest = ((data as Message[]) ?? []).find(
    (message) => !(message.hidden_for ?? []).includes(userId) && !message.deleted_for_all,
  );

  return latest
    ? {
        ...latest,
        reply_to_id: latest.reply_to_id ?? null,
        deleted_for_all: latest.deleted_for_all ?? false,
        hidden_for: latest.hidden_for ?? [],
      }
    : null;
}

export async function fetchActivities(relationshipId: string) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('relationship_id', relationshipId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as Activity[];
}

export async function fetchCalendarEvents(relationshipId: string, month?: Date) {
  const base = month ?? new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('relationship_id', relationshipId)
    .gte('date_time', start.toISOString())
    .lte('date_time', end.toISOString())
    .order('date_time', { ascending: true });

  if (error) throw error;
  return data as CalendarEvent[];
}

/** Inclusive range fetch — used by Plan so week/month dots + agenda share one source. */
export async function fetchCalendarEventsInRange(
  relationshipId: string,
  from: Date,
  to: Date,
) {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('relationship_id', relationshipId)
    .gte('date_time', from.toISOString())
    .lte('date_time', to.toISOString())
    .order('date_time', { ascending: true });

  if (error) throw error;
  return data as CalendarEvent[];
}

/** Plans from start of today through the next N days — used for home / insights. */
export async function fetchUpcomingCalendarEvents(relationshipId: string, daysAhead = 120) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + daysAhead);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('relationship_id', relationshipId)
    .gte('date_time', start.toISOString())
    .lte('date_time', end.toISOString())
    .order('date_time', { ascending: true });

  if (error) throw error;
  return data as CalendarEvent[];
}

/** Recent past plans — surface as memories on Plan. */
export async function fetchPastCalendarEvents(relationshipId: string, daysBack = 45) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('relationship_id', relationshipId)
    .gte('date_time', start.toISOString())
    .lt('date_time', end.toISOString())
    .order('date_time', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data as CalendarEvent[];
}

export async function createCalendarEvent(
  relationshipId: string,
  event: Omit<CalendarEvent, 'id' | 'relationship_id' | 'created_at'>,
) {
  const { data, error } = await supabase
    .from('calendar_events')
    .insert({ relationship_id: relationshipId, ...event })
    .select()
    .single();
  if (error) throw error;
  return data as CalendarEvent;
}

export async function updateCalendarEvent(
  eventId: string,
  patch: Partial<Pick<CalendarEvent, 'title' | 'date_time' | 'type' | 'description'>>,
) {
  const { data, error } = await supabase
    .from('calendar_events')
    .update(patch)
    .eq('id', eventId)
    .select()
    .single();
  if (error) throw error;
  return data as CalendarEvent;
}

export async function deleteCalendarEvent(eventId: string) {
  const { error } = await supabase.from('calendar_events').delete().eq('id', eventId);
  if (error) throw error;
}

export async function fetchLatestMoods(relationshipId: string, memberIds?: string[]) {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let userIds = uniqueUserIds([...(memberIds ?? []), authUser?.id]);

  if (userIds.length === 0) {
    const { data: rel, error: relError } = await supabase
      .from('relationships')
      .select('user_1_id, user_2_id')
      .eq('id', relationshipId)
      .maybeSingle();
    if (relError) throw relError;
    userIds = uniqueUserIds([rel?.user_1_id, rel?.user_2_id, authUser?.id]);
  }

  if (userIds.length === 0) return {};

  const rows = await Promise.all(
    userIds.map(async (userId) => {
      const { data, error } = await supabase
        .from('mood_logs')
        .select('*')
        .eq('relationship_id', relationshipId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as MoodLog | null;
    }),
  );

  const latest: Record<string, MoodLog> = {};
  for (const log of rows) {
    if (log) latest[log.user_id] = log;
  }
  return latest;
}

function uniqueUserIds(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter(Boolean) as string[])];
}

/** Most-used moods for a user, most frequent first. */
export async function fetchMoodFrequency(relationshipId: string, userId: string, limit = 40) {
  const { data, error } = await supabase
    .from('mood_logs')
    .select('mood')
    .eq('relationship_id', relationshipId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.mood, (counts.get(row.mood) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([mood]) => mood);
}

/** Paginated mood history for a relationship. */
export async function fetchMoodHistoryPage(
  relationshipId: string,
  options?: {
    limit?: number;
    before?: string;
    filterUserId?: string | null;
  },
) {
  const limit = options?.limit ?? 50;
  const { data, error } = await supabase.rpc('get_mood_history_page', {
    p_relationship_id: relationshipId,
    p_limit: limit,
    p_before: options?.before ?? null,
    p_filter_user_id: options?.filterUserId ?? null,
  });

  if (!error) {
    return (data ?? []) as MoodLog[];
  }

  let query = supabase
    .from('mood_logs')
    .select('*')
    .eq('relationship_id', relationshipId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options?.filterUserId) {
    query = query.eq('user_id', options.filterUserId);
  }
  if (options?.before) {
    query = query.lt('created_at', options.before);
  }

  const fallback = await query;
  if (fallback.error) throw fallback.error;
  return (fallback.data ?? []) as MoodLog[];
}

export async function fetchMoodHistoryOverview(
  relationshipId: string,
  options: {
    filter: MoodHistoryFilter;
    userId: string;
    partnerId?: string | null;
    days?: number;
    weeks?: number;
  },
) {
  const filterUserId = resolveMoodFilterUserId(options.filter, options.userId, options.partnerId);
  const offsetMinutes = getLocalTimezoneOffsetMinutes();

  const { data, error } = await supabase.rpc('get_mood_history_overview', {
    p_relationship_id: relationshipId,
    p_filter_user_id: filterUserId,
    p_days: options.days ?? 14,
    p_weeks: options.weeks ?? 8,
    p_offset_minutes: offsetMinutes,
  });

  if (!error && data) {
    return mapRpcOverview(data as RpcMoodHistoryOverview, options.userId, options.partnerId);
  }

  let query = supabase
    .from('mood_logs')
    .select('*')
    .eq('relationship_id', relationshipId)
    .order('created_at', { ascending: false })
    .limit(500);

  if (filterUserId) {
    query = query.eq('user_id', filterUserId);
  }

  const fallback = await query;
  if (fallback.error) throw fallback.error;
  return buildOverviewFromLogs((fallback.data ?? []) as MoodLog[], options.userId, options.partnerId);
}

/** @deprecated Use fetchMoodHistoryPage */
export async function fetchMoodHistory(relationshipId: string, limit = 200) {
  return fetchMoodHistoryPage(relationshipId, { limit });
}

export async function updateMood(relationshipId: string, mood: string) {
  const { data: rpcData, error: rpcError } = await supabase.rpc('log_mood', {
    p_relationship_id: relationshipId,
    p_mood: mood,
  });

  if (!rpcError && rpcData) {
    return rpcData as MoodLog;
  }

  const missingRpc =
    rpcError &&
    typeof rpcError === 'object' &&
    (('code' in rpcError && String(rpcError.code) === 'PGRST202') ||
      getErrorMessage(rpcError)?.includes('log_mood'));

  if (rpcError && !missingRpc) {
    throw rpcError;
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw authError ?? new Error('Not authenticated');

  const { data, error } = await supabase
    .from('mood_logs')
    .insert({ relationship_id: relationshipId, user_id: user.id, mood })
    .select()
    .single();
  if (error) throw error;
  return data as MoodLog;
}

export async function fetchStreakStatus(relationshipId: string): Promise<StreakStatus | null> {
  const { data, error } = await supabase.rpc('get_streak_status', {
    p_relationship_id: relationshipId,
  });

  if (!error && data) {
    const status = parseStreakStatus(data);
    if (!status) return null;

    // Only fall back to client table scans when the RPC omitted day lists.
    const needsActive = status.active_days === undefined;
    const needsActivity = status.activity_days === undefined;
    const [activeDays, activityDays] = await Promise.all([
      needsActive ? fetchStreakActiveDays(relationshipId) : Promise.resolve([] as string[]),
      needsActivity ? fetchRelationshipActivityDays(relationshipId) : Promise.resolve([] as string[]),
    ]);

    const mergedActive = mergeDayLists(status.active_days, activeDays);
    const mergedActivity = mergeDayLists(status.activity_days, activityDays);

    return withEffectiveStreakRestore({
      ...status,
      active_days: mergedActive.length > 0 ? mergedActive : undefined,
      activity_days: mergedActivity.length > 0 ? mergedActivity : undefined,
    });
  }

  const { data: row, error: rowError } = await supabase
    .from('streaks')
    .select('current_streak, longest_streak, last_active_date, restorable_streak, restorable_lost_at')
    .eq('relationship_id', relationshipId)
    .maybeSingle();
  if (rowError || !row) return null;
  const status = legacyStreakToStatus(relationshipId, row);
  const canRestore =
    status.current_streak === 0 &&
    typeof row.restorable_streak === 'number' &&
    row.restorable_streak > 0;
  const [activeDays, activityDays] = await Promise.all([
    fetchStreakActiveDays(relationshipId),
    fetchRelationshipActivityDays(relationshipId),
  ]);
  return withEffectiveStreakRestore({
    ...status,
    can_restore_streak: canRestore,
    restorable_streak: canRestore ? row.restorable_streak : null,
    restorable_lost_at:
      typeof row.restorable_lost_at === 'string' ? row.restorable_lost_at : null,
    active_days: mergeDayLists(activeDays),
    activity_days: activityDays,
  });
}

function mergeDayLists(...lists: (string[] | undefined)[]): string[] {
  const out = new Set<string>();
  for (const list of lists) {
    for (const day of list ?? []) {
      out.add(day);
    }
  }
  return [...out].sort();
}

function trackActivityDate(dates: Set<string>, value: string | null | undefined) {
  if (!value) return;
  const parsed = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return;
  dates.add(format(startOfDay(parsed), 'yyyy-MM-dd'));
}

async function fetchRelationshipActivityDays(relationshipId: string): Promise<string[]> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const sinceIso = since.toISOString();
  const dates = new Set<string>();

  const [moments, messages, moods, challenges] = await Promise.all([
    supabase
      .from('moments')
      .select('created_at')
      .eq('relationship_id', relationshipId)
      .gte('created_at', sinceIso),
    supabase
      .from('messages')
      .select('created_at')
      .eq('relationship_id', relationshipId)
      .gte('created_at', sinceIso),
    supabase
      .from('mood_logs')
      .select('created_at')
      .eq('relationship_id', relationshipId)
      .gte('created_at', sinceIso),
    supabase
      .from('daily_challenges')
      .select('challenge_date, user_1_response, user_2_response')
      .eq('relationship_id', relationshipId)
      .gte('challenge_date', sinceIso.slice(0, 10)),
  ]);

  for (const row of moments.data ?? []) trackActivityDate(dates, row.created_at);
  for (const row of messages.data ?? []) trackActivityDate(dates, row.created_at);
  for (const row of moods.data ?? []) trackActivityDate(dates, row.created_at);
  for (const row of challenges.data ?? []) {
    if (row.user_1_response || row.user_2_response) {
      trackActivityDate(dates, row.challenge_date);
    }
  }

  return [...dates].sort();
}

async function fetchStreakActiveDays(relationshipId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('streak_active_days')
    .select('activity_date')
    .eq('relationship_id', relationshipId)
    .order('activity_date', { ascending: true });
  if (error || !data) return [];
  return data
    .map((row) => row.activity_date)
    .filter((d): d is string => typeof d === 'string');
}

export async function restoreStreak(relationshipId: string): Promise<StreakStatus | null> {
  const { data, error } = await supabase.rpc('restore_streak', {
    p_relationship_id: relationshipId,
  });
  if (error) throw error;
  const status = parseStreakStatus(data);
  return status ? withEffectiveStreakRestore(status) : null;
}

/** @deprecated use fetchStreakStatus */
export async function fetchStreak(relationshipId: string) {
  const { data, error } = await supabase
    .from('streaks')
    .select('*')
    .eq('relationship_id', relationshipId)
    .single();
  if (error) return null;
  return data as Streak;
}

export async function fetchDailyChallenge(relationshipId: string, challengeDate?: string) {
  const today = challengeDate ?? localCalendarDate();
  const { data, error } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('relationship_id', relationshipId)
    .eq('challenge_date', today)
    .maybeSingle();

  if (error) throw error;
  return data as DailyChallenge | null;
}

/** Ensure today's prompt exists (edge function, then client fallback). */
export async function ensureDailyChallenge(relationshipId: string): Promise<DailyChallenge> {
  const today = localCalendarDate();
  const existing = await fetchDailyChallenge(relationshipId, today);
  if (existing && existing.type !== 'skipped') return existing;
  if (existing?.type === 'skipped') {
    // Skipped row still occupies today — treat as needing a fresh prompt on that row
  }

  try {
    const generated = await invokeEdgeFunction<DailyChallenge>('generate-daily-challenge', {
      relationship_id: relationshipId,
      challenge_date: today,
    });
    if (generated?.id) return generated;
  } catch {
    // Fall through to client insert
  }

  const { getDailyQuestion } = await import('@/constants/activity-content');
  const prompt = getDailyQuestion();

  if (existing?.type === 'skipped') {
    const { data, error } = await supabase
      .from('daily_challenges')
      .update({
        prompt,
        type: 'question',
        user_1_response: null,
        user_2_response: null,
        completed: false,
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as DailyChallenge;
  }

  const { data, error } = await supabase
    .from('daily_challenges')
    .insert({
      relationship_id: relationshipId,
      prompt,
      type: 'question',
      challenge_date: today,
    })
    .select()
    .single();

  if (error) {
    const raced = await fetchDailyChallenge(relationshipId, today);
    if (raced) return raced;
    throw error;
  }

  return data as DailyChallenge;
}

export async function respondToDailyChallenge(
  challengeId: string,
  userId: string,
  relationship: Relationship,
  response: string,
  responderName?: string | null,
) {
  const field = challengeResponseField(relationship, userId);

  const { data, error } = await supabase
    .from('daily_challenges')
    .update({ [field]: response })
    .eq('id', challengeId)
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error('Could not save your answer. Please try again.');

  const updated = data as DailyChallenge;
  const bothIn = Boolean(updated.user_1_response && updated.user_2_response);

  if (bothIn && !updated.completed) {
    const { data: completedRow, error: completeError } = await supabase
      .from('daily_challenges')
      .update({ completed: true })
      .eq('id', challengeId)
      .select()
      .single();
    if (!completeError && completedRow) {
      Object.assign(updated, completedRow);
    }
  }

  // Never block the answer UX on notifications / push.
  const partnerId =
    relationship.user_1_id === userId ? relationship.user_2_id : relationship.user_1_id;
  if (partnerId) {
    void notifyPartnerPromptAnswered({
      relationshipId: relationship.id,
      partnerId,
      challengeId,
      userId,
      bothIn,
      responderName,
    });
  }

  return updated;
}

async function notifyPartnerPromptAnswered({
  relationshipId,
  partnerId,
  challengeId,
  userId,
  bothIn,
  responderName,
}: {
  relationshipId: string;
  partnerId: string;
  challengeId: string;
  userId: string;
  bothIn: boolean;
  responderName?: string | null;
}) {
  try {
    const name = responderName?.trim() || 'Your partner';
    const dedupKey = `prompt_answer:${challengeId}:${userId}:${bothIn ? 'reveal' : 'turn'}`;
    let shouldNotify = true;
    try {
      const { data: claimed, error: dedupError } = await supabase.rpc('try_notification_dedup', {
        p_relationship_id: relationshipId,
        p_dedup_key: dedupKey,
      });
      if (!dedupError && claimed === false) shouldNotify = false;
    } catch {
      shouldNotify = true;
    }

    if (shouldNotify) {
      await sendPartnerNotification(
        relationshipId,
        partnerId,
        'challenge',
        bothIn
          ? `${name} answered today's question. You can both see the answers now.`
          : `${name} answered today's question. Your turn!`,
      );
    } else {
      void dispatchPendingPushNotifications();
    }
  } catch {
    // Notification must not block answering
  }
}

export async function fetchDailyChallengeHistory(relationshipId: string, limit = 30) {
  const { data, error } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('relationship_id', relationshipId)
    .order('challenge_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DailyChallenge[];
}

export async function fetchBucketList(relationshipId: string) {
  const { data, error } = await supabase
    .from('bucket_list')
    .select('*')
    .eq('relationship_id', relationshipId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as BucketListItem[];
}

export async function fetchSharedGoals(relationshipId: string) {
  const { data, error } = await supabase
    .from('shared_goals')
    .select('*')
    .eq('relationship_id', relationshipId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as SharedGoal[];
}

// Experiences marketplace paused — re-enable when backend is ready.
/*
export async function fetchExperiences() {
  const { data, error } = await supabase.from('experiences').select('*').limit(50);
  if (error) throw error;
  return data as Experience[];
}

export async function fetchSavedExperienceIds(relationshipId: string) {
  const { data, error } = await supabase
    .from('saved_experiences')
    .select('experience_id')
    .eq('relationship_id', relationshipId);
  if (error) throw error;
  return (data ?? []).map((row) => row.experience_id as string);
}

export async function saveExperience(relationshipId: string, experienceId: string) {
  const { error } = await supabase
    .from('saved_experiences')
    .insert({ relationship_id: relationshipId, experience_id: experienceId });
  if (error) throw error;
}

export async function unsaveExperience(relationshipId: string, experienceId: string) {
  const { error } = await supabase
    .from('saved_experiences')
    .delete()
    .eq('relationship_id', relationshipId)
    .eq('experience_id', experienceId);
  if (error) throw error;
}
*/

export async function fetchNotifications(userId: string) {
  return fetchNotificationsPage(userId, { limit: 50 });
}

export async function fetchNotificationsPage(
  userId: string,
  options?: { limit?: number; before?: string },
) {
  const limit = options?.limit ?? 30;
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .not('type', 'in', '(message,message_new)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options?.before) {
    query = query.lt('created_at', options.before);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Notification[];
  return hydrateNotificationMedia(rows);
}

async function hydrateNotificationMedia(items: Notification[]): Promise<Notification[]> {
  if (items.length === 0) return items;
  const { signMomentsMediaUrl } = await import('@/lib/moment-media');
  return Promise.all(
    items.map(async (item) => {
      if (!item.media_url) return item;
      try {
        const signed = await signMomentsMediaUrl(item.media_url, 'thumb');
        return signed ? { ...item, media_url: signed } : item;
      } catch {
        return item;
      }
    }),
  );
}

export async function fetchUnreadNotificationCount(userId: string) {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
    .not('type', 'in', '(message,message_new)');

  if (error) throw error;
  return count ?? 0;
}

export async function deleteNotification(notificationId: string, userId: string) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function clearAllNotifications(userId: string) {
  const { error } = await supabase.from('notifications').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function markNotificationsRead(notificationIds?: string[]) {
  const { error } = await supabase.rpc('mark_notifications_read', {
    p_notification_ids: notificationIds?.length ? notificationIds : null,
  });
  if (error) throw error;
}

export async function registerPushToken(token: string | null) {
  const { error } = await supabase.rpc('register_push_token', {
    p_token: token,
  });
  if (error) throw error;
}

export async function dispatchPendingPushNotifications(limit = 10) {
  try {
    await invokeEdgeFunction<{ sent?: number; skipped?: number }>('send-push-notification', {
      limit,
    });
  } catch {
    // Best-effort: und deployed edge functions or missing push tokens must not crash the app.
  }
}

export async function uploadMedia(
  bucket: string,
  path: string,
  uri: string,
  contentType: string,
) {
  const arrayBuffer = await readUriAsArrayBuffer(uri);

  const { data, error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;

  return createStorageSignedUrl(bucket, data.path, {
    size: bucket === 'profiles' ? 'thumb' : 'full',
  });
}

/** Upload moment media to the private `moments` bucket; returns a long-lived signed URL. */
export async function uploadMomentMedia(path: string, uri: string, contentType: string) {
  return uploadMedia('moments', path, uri, contentType);
}

/** Upload chat media to the private `chat` bucket; returns a long-lived signed URL. */
export async function uploadChatMedia(path: string, uri: string, contentType: string) {
  const arrayBuffer = await readUriAsArrayBuffer(uri);

  const { data, error } = await supabase.storage.from('chat').upload(path, arrayBuffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;

  return createStorageSignedUrl('chat', data.path, { size: 'full' });
}

/** Upload avatar to private profiles bucket; returns a long-lived signed URL. */
export async function uploadProfileAvatar(userId: string, uri: string) {
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const arrayBuffer = await readUriAsArrayBuffer(uri);

  const { data, error } = await supabase.storage.from('profiles').upload(path, arrayBuffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;

  return createStorageSignedUrl('profiles', data.path, { size: 'thumb' });
}

export async function invokeEdgeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data as T;
}

export async function trackEvent(
  relationshipId: string,
  userId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from('analytics_events').insert({
    relationship_id: relationshipId,
    user_id: userId,
    event_type: eventType,
    metadata,
  });
}

function throwSaveError(error: unknown, fallback: string, columnHint?: string): never {
  if (isNoRowsUpdatedError(error)) {
    throw new Error('Unable to save changes. Try signing out and back in.');
  }
  if (columnHint && isMissingColumnError(error, columnHint)) {
    throw new Error(
      'This feature is not available on the server yet. Apply the latest database migrations and try again.',
    );
  }
  throw toUserFacingNetworkError(error, fallback);
}

export async function updateRelationshipAnniversary(relationshipId: string, anniversaryDate: string) {
  if (!isValidAnniversaryIso(anniversaryDate)) {
    throw new Error('Please pick a valid anniversary date.');
  }

  const { data, error } = await supabase.rpc('set_relationship_anniversary', {
    p_relationship_id: relationshipId,
    p_anniversary_date: anniversaryDate,
  });

  if (!error && data) {
    return data as Relationship;
  }

  if (error && !isRpcNotFoundError(error, 'set_relationship_anniversary')) {
    throwSaveError(error, 'Could not save your anniversary. Please try again.', 'anniversary_date');
  }

  return updateRelationship(relationshipId, { anniversary_date: anniversaryDate });
}

export async function updateRelationship(relationshipId: string, updates: Partial<Relationship>) {
  const { data, error } = await supabase
    .from('relationships')
    .update(updates)
    .eq('id', relationshipId)
    .select()
    .single();
  if (error) {
    throwSaveError(error, 'Could not save. Please try again.', 'anniversary_date');
  }
  return data as Relationship;
}

export async function createBucketListItem(relationshipId: string, title: string, note?: string) {
  const { data, error } = await supabase
    .from('bucket_list')
    .insert({ relationship_id: relationshipId, title, note: note ?? null, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return data as BucketListItem;
}

export async function updateBucketListItem(id: string, updates: Partial<BucketListItem>) {
  const { data, error } = await supabase.from('bucket_list').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as BucketListItem;
}

export async function createSharedGoal(relationshipId: string, title: string) {
  const { data, error } = await supabase
    .from('shared_goals')
    .insert({ relationship_id: relationshipId, title, progress: 0, status: 'active' })
    .select()
    .single();
  if (error) throw error;
  return data as SharedGoal;
}

export async function updateSharedGoal(id: string, updates: Partial<SharedGoal>) {
  const { data, error } = await supabase.from('shared_goals').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as SharedGoal;
}

export async function toggleMessageReaction(messageId: string, userId: string, emoji: string) {
  const { error } = await supabase.rpc('toggle_message_reaction', {
    p_message_id: messageId,
    p_user_id: userId,
    p_emoji: emoji,
  });
  if (error) throw error;
}

export async function setMessagePinned(messageId: string, userId: string, isPinned: boolean) {
  const { error } = await supabase.rpc('set_message_pinned', {
    p_message_id: messageId,
    p_user_id: userId,
    p_is_pinned: isPinned,
  });
  if (error) throw error;
}

export async function hideMessageForUser(messageId: string, userId: string) {
  const { error } = await supabase.rpc('hide_message_for_user', {
    p_message_id: messageId,
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function deleteMessageForAll(messageId: string, senderId: string) {
  const { data: message, error: fetchError } = await supabase
    .from('messages')
    .select('id, sender_id, media_url')
    .eq('id', messageId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!message) return;
  if (message.sender_id !== senderId) {
    throw new Error('You can only delete messages you sent.');
  }

  const storagePath = extractChatStoragePath(message.media_url);
  if (storagePath) {
    await supabase.storage.from('chat').remove([storagePath]);
  }

  const { error } = await supabase
    .from('messages')
    .update({
      deleted_for_all: true,
      content: null,
      media_url: null,
      media_type: null,
      is_pinned: false,
    })
    .eq('id', messageId)
    .eq('sender_id', senderId);
  if (error) throw error;
}

export async function toggleMomentReaction(momentId: string, userId: string, emoji: string) {
  const { error } = await supabase.rpc('toggle_moment_reaction', {
    p_moment_id: momentId,
    p_user_id: userId,
    p_emoji: emoji,
  });
  if (error) throw error;
}

// --- Watch Together ---

export async function fetchActiveWatchSession(relationshipId: string): Promise<WatchSession | null> {
  const { data, error } = await supabase
    .from('watch_sessions')
    .select('*')
    .eq('relationship_id', relationshipId)
    .neq('status', 'ended')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return (data as WatchSession | null) ?? null;
}

export async function createWatchSession(
  relationshipId: string,
  hostUserId: string,
  payload: {
    title: string;
    link?: string;
    platformId?: string;
    contentId?: string;
    contentSource?: WatchSession['content_source'];
    scheduledAt?: string;
    reminderMinutes?: number;
    status?: WatchSession['status'];
  },
): Promise<WatchSession> {
  const status = payload.status ?? (payload.scheduledAt ? 'scheduled' : 'setup');
  const { data, error } = await supabase
    .from('watch_sessions')
    .insert({
      relationship_id: relationshipId,
      host_user_id: hostUserId,
      title: payload.title.trim(),
      link: payload.link?.trim() || null,
      platform_id: payload.platformId ?? null,
      content_id: payload.contentId ?? null,
      content_source: payload.contentSource ?? 'streaming',
      scheduled_at: payload.scheduledAt ?? null,
      reminder_minutes: payload.reminderMinutes ?? null,
      status,
      ready_user_ids: status === 'scheduled' ? [] : [hostUserId],
    })
    .select()
    .single();
  if (error) throw error;
  return data as WatchSession;
}

export async function updateWatchSession(sessionId: string, updates: Partial<WatchSession>) {
  const { data, error } = await supabase
    .from('watch_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single();
  if (error) throw error;
  return data as WatchSession;
}

export async function markWatchReady(sessionId: string, userId: string, readyIds: string[]) {
  const next = readyIds.includes(userId) ? readyIds : [...readyIds, userId];
  return updateWatchSession(sessionId, { ready_user_ids: next });
}

export async function startWatchCountdown(sessionId: string) {
  const countdownAt = new Date(Date.now() + 5000).toISOString();
  return updateWatchSession(sessionId, { status: 'countdown', countdown_at: countdownAt });
}

export async function beginWatching(sessionId: string) {
  return updateWatchSession(sessionId, { status: 'watching', countdown_at: null });
}

export async function setWatchPlayback(
  sessionId: string,
  playbackState: WatchSession['playback_state'],
  position?: number,
) {
  return updateWatchSession(sessionId, {
    playback_state: playbackState,
    playback_updated_at: new Date().toISOString(),
    ...(position != null ? { playback_position: Math.round(position) } : {}),
  });
}

export async function startScheduledSession(sessionId: string, hostUserId: string) {
  return updateWatchSession(sessionId, {
    status: 'watching',
    ready_user_ids: [hostUserId],
    scheduled_at: null,
    playback_state: 'paused',
    playback_position: 0,
  });
}

export async function addWatchReaction(sessionId: string, reactions: WatchReaction[], userId: string, emoji: string) {
  const next: WatchReaction[] = [...reactions, { user_id: userId, emoji, at: new Date().toISOString() }].slice(-40);
  return updateWatchSession(sessionId, { reactions: next });
}

export async function endWatchSession(sessionId: string) {
  return updateWatchSession(sessionId, { status: 'ended' });
}

export async function fetchWatchMessages(sessionId: string): Promise<WatchMessage[]> {
  const { data, error } = await supabase
    .from('watch_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return (data as WatchMessage[]) ?? [];
}

export async function sendWatchMessage(
  sessionId: string,
  relationshipId: string,
  senderId: string,
  message: string,
): Promise<WatchMessage> {
  const { data, error } = await supabase
    .from('watch_messages')
    .insert({
      session_id: sessionId,
      relationship_id: relationshipId,
      sender_id: senderId,
      message: message.trim(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as WatchMessage;
}

export async function fetchStreamingConnections(userId: string): Promise<StreamingConnection[]> {
  const { data, error } = await supabase
    .from('user_streaming_connections')
    .select('*')
    .eq('user_id', userId)
    .order('connected_at', { ascending: false });
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return (data as StreamingConnection[]) ?? [];
}

export async function connectStreamingPlatform(userId: string, platformId: string, accountLabel?: string) {
  const { data, error } = await supabase
    .from('user_streaming_connections')
    .upsert(
      {
        user_id: userId,
        platform_id: platformId,
        account_label: accountLabel ?? null,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,platform_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data as StreamingConnection;
}

export async function sendPartnerNotification(
  relationshipId: string,
  partnerUserId: string,
  type: string,
  content: string,
  extras?: { mediaUrl?: string | null; relatedId?: string | null },
) {
  const { error } = await supabase.rpc('create_partner_notification', {
    p_relationship_id: relationshipId,
    p_recipient_id: partnerUserId,
    p_type: type,
    p_content: content,
    p_media_url: extras?.mediaUrl ?? null,
    p_related_id: extras?.relatedId ?? null,
  });
  if (error && !isMissingTableError(error)) {
    if (extras?.mediaUrl || extras?.relatedId) {
      const fallback = await supabase.rpc('create_partner_notification', {
        p_relationship_id: relationshipId,
        p_recipient_id: partnerUserId,
        p_type: type,
        p_content: content,
      });
      if (fallback.error && !isMissingTableError(fallback.error)) throw fallback.error;
    } else {
      throw error;
    }
  }
  void dispatchPendingPushNotifications();
}

export async function notifyWatchPartyStarted(
  relationshipId: string,
  partnerUserId: string,
  hostName: string,
  title: string,
) {
  await sendPartnerNotification(
    relationshipId,
    partnerUserId,
    'watch_party',
    `${hostName} started a watch party: ${title}`,
  );
}

export async function nudgePartnerToWatchParty(
  relationshipId: string,
  partnerUserId: string,
  senderName: string,
) {
  await sendPartnerNotification(
    relationshipId,
    partnerUserId,
    'watch_party_nudge',
    `${senderName} is waiting for you in Watch Together`,
  );
}

export async function notifyWatchPartyScheduled(
  relationshipId: string,
  partnerUserId: string,
  hostName: string,
  title: string,
  whenLabel: string,
) {
  await sendPartnerNotification(
    relationshipId,
    partnerUserId,
    'watch_party_scheduled',
    `${hostName} scheduled ${title} for ${whenLabel} 🍿`,
  );
}

// --- Upcoming / scheduled sessions ---

export async function fetchUpcomingSessions(relationshipId: string): Promise<WatchSession[]> {
  const { data, error } = await supabase
    .from('watch_sessions')
    .select('*')
    .eq('relationship_id', relationshipId)
    .eq('status', 'scheduled')
    .order('scheduled_at', { ascending: true });
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return (data as WatchSession[]) ?? [];
}

// --- Shared watchlist ---

export async function fetchWatchlist(relationshipId: string): Promise<WatchlistItem[]> {
  const { data, error } = await supabase
    .from('watch_watchlist')
    .select('*')
    .eq('relationship_id', relationshipId)
    .order('watched', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return (data as WatchlistItem[]) ?? [];
}

export async function addWatchlistItem(
  relationshipId: string,
  addedBy: string,
  payload: { title: string; platformId?: string; note?: string },
): Promise<WatchlistItem> {
  const { data, error } = await supabase
    .from('watch_watchlist')
    .insert({
      relationship_id: relationshipId,
      added_by: addedBy,
      title: payload.title.trim(),
      platform_id: payload.platformId ?? null,
      note: payload.note?.trim() || null,
      votes: {},
    })
    .select()
    .single();
  if (error) throw error;
  return data as WatchlistItem;
}

export async function voteWatchlistItem(
  itemId: string,
  votes: Record<string, WatchVote>,
  userId: string,
  vote: WatchVote,
) {
  const next = { ...votes };
  if (next[userId] === vote) {
    delete next[userId];
  } else {
    next[userId] = vote;
  }
  const { data, error } = await supabase
    .from('watch_watchlist')
    .update({ votes: next })
    .eq('id', itemId)
    .select()
    .single();
  if (error) throw error;
  return data as WatchlistItem;
}

export async function setWatchlistWatched(itemId: string, watched: boolean) {
  const { data, error } = await supabase
    .from('watch_watchlist')
    .update({ watched, watched_at: watched ? new Date().toISOString() : null })
    .eq('id', itemId)
    .select()
    .single();
  if (error) throw error;
  return data as WatchlistItem;
}

export async function removeWatchlistItem(itemId: string) {
  const { error } = await supabase.from('watch_watchlist').delete().eq('id', itemId);
  if (error) throw error;
}

// --- Watch history ---

export async function fetchWatchHistory(relationshipId: string): Promise<WatchHistoryEntry[]> {
  const { data, error } = await supabase
    .from('watch_history')
    .select('*')
    .eq('relationship_id', relationshipId)
    .order('watched_at', { ascending: false });
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return (data as WatchHistoryEntry[]) ?? [];
}

export async function addWatchHistoryEntry(
  relationshipId: string,
  loggedBy: string,
  payload: {
    title: string;
    platformId?: string | null;
    contentId?: string | null;
    rating?: number;
    favoriteMoment?: string;
    promptQuestion?: string;
    promptAnswer?: string;
  },
): Promise<WatchHistoryEntry> {
  const { data, error } = await supabase
    .from('watch_history')
    .insert({
      relationship_id: relationshipId,
      logged_by: loggedBy,
      title: payload.title.trim(),
      platform_id: payload.platformId ?? null,
      content_id: payload.contentId ?? null,
      rating: payload.rating ?? null,
      favorite_moment: payload.favoriteMoment?.trim() || null,
      prompt_question: payload.promptQuestion ?? null,
      prompt_answer: payload.promptAnswer?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as WatchHistoryEntry;
}

// --- Quiz Live ---

export async function fetchActiveQuizLiveSession(relationshipId: string): Promise<QuizLiveSession | null> {
  const { data, error } = await supabase
    .from('quiz_live_sessions')
    .select('*')
    .eq('relationship_id', relationshipId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  if (!data) return null;
  return normalizeQuizLiveSession(data);
}

function normalizeQuizLiveSession(row: Record<string, unknown>): QuizLiveSession {
  const base = row as unknown as QuizLiveSession;
  return {
    ...base,
    questions: parseQuizQuestions(row.questions),
    responses: (row.responses as Record<string, Record<string, number>>) ?? {},
    scores: (row.scores as Record<string, number>) ?? {},
  };
}

export async function endActiveQuizLiveSessions(relationshipId: string): Promise<void> {
  const { error } = await supabase
    .from('quiz_live_sessions')
    .update({ status: 'finished', updated_at: new Date().toISOString() })
    .eq('relationship_id', relationshipId)
    .in('status', ['lobby', 'generating', 'active']);
  if (error && !isMissingTableError(error)) throw error;
}

export async function createQuizLiveSession(
  relationshipId: string,
  hostUserId: string,
  topic: string,
): Promise<QuizLiveSession> {
  const { data, error } = await supabase
    .from('quiz_live_sessions')
    .insert({
      relationship_id: relationshipId,
      host_user_id: hostUserId,
      topic: topic.trim(),
      status: 'lobby',
    })
    .select()
    .single();
  if (error) throw error;
  return normalizeQuizLiveSession(data as Record<string, unknown>);
}

export async function updateQuizLiveSession(
  sessionId: string,
  updates: Partial<QuizLiveSession>,
): Promise<QuizLiveSession> {
  const { data, error } = await supabase
    .from('quiz_live_sessions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select()
    .single();
  if (error) throw error;
  return normalizeQuizLiveSession(data as Record<string, unknown>);
}

export async function startQuizLiveSession(
  relationshipId: string,
  hostUserId: string,
  topic: string,
): Promise<QuizLiveSession> {
  await endActiveQuizLiveSessions(relationshipId);
  const created = await createQuizLiveSession(relationshipId, hostUserId, topic);
  await updateQuizLiveSession(created.id, { status: 'generating' });

  let questions: QuizLiveQuestion[] = [];
  try {
    const result = await invokeEdgeFunction<{ questions: QuizLiveQuestion[] }>('generate-quiz-live', {
      relationship_id: relationshipId,
      topic: topic.trim(),
      count: 6,
    });
    questions = parseQuizQuestions(result.questions);
  } catch {
    questions = [];
  }
  if (!questions.length) {
    questions = clientFallbackQuestions(topic.trim());
  }

  return updateQuizLiveSession(created.id, {
    status: 'active',
    round_phase: 'answer',
    current_index: 0,
    questions,
    responses: {},
    scores: {},
  });
}

export async function submitQuizLiveAnswer(
  session: QuizLiveSession,
  userId: string,
  answerIndex: number,
  memberIds: string[],
): Promise<QuizLiveSession> {
  const key = String(session.current_index);
  const responses = { ...session.responses };
  const round = { ...(responses[key] ?? {}) };
  round[userId] = answerIndex;
  responses[key] = round;

  const updates: Partial<QuizLiveSession> = { responses };
  const allAnswered = memberIds.length > 0 && memberIds.every((id) => typeof round[id] === 'number');

  if (allAnswered) {
    updates.round_phase = 'reveal';
    const question = session.questions[session.current_index];
    let scores = { ...session.scores };
    if (question) {
      for (const id of memberIds) {
        const partnerId = memberIds.find((m) => m !== id);
        const partnerAnswer = partnerId !== undefined ? round[partnerId] : undefined;
        const pts = computeRoundPoints(question, round[id], partnerAnswer);
        scores = mergeScores(scores, id, pts);
      }
    }
    updates.scores = scores;
  }

  return updateQuizLiveSession(session.id, updates);
}

export async function advanceQuizLiveRound(session: QuizLiveSession): Promise<QuizLiveSession> {
  const nextIndex = session.current_index + 1;
  if (nextIndex >= session.questions.length) {
    return updateQuizLiveSession(session.id, { status: 'finished', round_phase: 'reveal' });
  }
  return updateQuizLiveSession(session.id, {
    current_index: nextIndex,
    round_phase: 'answer',
  });
}

export async function endQuizLiveSession(sessionId: string): Promise<QuizLiveSession> {
  return updateQuizLiveSession(sessionId, { status: 'finished', round_phase: 'reveal' });
}
