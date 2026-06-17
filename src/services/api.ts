import { isMissingTableError } from '@/lib/network-error';
import { hasActiveUserSubscription } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import type {
    Activity,
    BucketListItem,
    CalendarEvent,
    DailyChallenge,
    Experience,
    JournalEntry,
    Message,
    Moment,
    MoodLog,
    Notification,
    Relationship,
    SharedGoal,
    Streak,
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
  if (error) throw error;
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
    .limit(1);

  if (error || !relationships?.length) return { relationship: null, partner: null };

  const relationship = relationships[0] as Relationship;
  const partnerId =
    relationship.user_1_id === userId ? relationship.user_2_id : relationship.user_1_id;

  let partner: UserProfile | null = null;
  if (partnerId) {
    partner = await fetchProfile(partnerId);
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

export async function createRelationship(userId: string, name: string) {
  const inviteCode = generateInviteCode();
  const { data, error } = await supabase
    .from('relationships')
    .insert({
      user_1_id: userId,
      relationship_name: name,
      invite_code: inviteCode,
      status: 'pending',
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

export async function joinRelationship(userId: string, inviteCode: string) {
  const normalizedCode = inviteCode.toUpperCase().trim();

  const { data: rel, error: findError } = await supabase
    .from('relationships')
    .select('*')
    .eq('invite_code', normalizedCode)
    .eq('status', 'pending')
    .is('user_2_id', null)
    .single();

  if (findError || !rel) throw new Error('Invalid or expired invite code');

  if (rel.user_1_id === userId) {
    throw new Error("That's your own code. Share it with your partner, or enter their code instead.");
  }

  await endEmptySoloRelationships(userId);

  const { data, error } = await supabase
    .from('relationships')
    .update({ user_2_id: userId, status: 'active', invite_code: null })
    .eq('id', rel.id)
    .select()
    .single();

  if (error) throw error;
  return syncRelationshipSubscription(data as Relationship, [data.user_1_id, userId]);
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
  return data as Moment[];
}

export async function createMoment(
  relationshipId: string,
  userId: string,
  moment: {
    type: 'photo' | 'video';
    media_url: string;
  },
) {
  const { data, error } = await supabase
    .from('moments')
    .insert({ relationship_id: relationshipId, user_id: userId, ...moment })
    .select()
    .single();
  if (error) throw error;

  await supabase.rpc('update_streak', { p_relationship_id: relationshipId });
  return data as Moment;
}

export async function fetchMomentById(momentId: string) {
  const { data, error } = await supabase.from('moments').select('*').eq('id', momentId).maybeSingle();
  if (error) throw error;
  return data as Moment | null;
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

  await supabase.rpc('update_streak', { p_relationship_id: relationshipId });
  return data as Message;
}

export async function markMessagesRead(relationshipId: string, userId: string) {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('relationship_id', relationshipId)
    .neq('sender_id', userId)
    .is('read_at', null);
}

export async function fetchUnreadMessageCount(relationshipId: string, userId: string) {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('relationship_id', relationshipId)
    .neq('sender_id', userId)
    .is('read_at', null);

  if (error) throw error;
  return count ?? 0;
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
  const start = month ? new Date(month.getFullYear(), month.getMonth(), 1) : new Date();
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);

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

/** Future plans across the next N days — used for live countdown hero. */
export async function fetchUpcomingCalendarEvents(relationshipId: string, daysAhead = 120) {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + daysAhead);

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

export async function fetchJournalEntries(relationshipId: string) {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('relationship_id', relationshipId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as JournalEntry[];
}

export async function createJournalEntry(
  relationshipId: string,
  userId: string,
  entry: { content: string; type: string; is_private?: boolean },
) {
  const { data, error } = await supabase
    .from('journal_entries')
    .insert({ relationship_id: relationshipId, user_id: userId, ...entry })
    .select()
    .single();
  if (error) throw error;

  await supabase.rpc('update_streak', { p_relationship_id: relationshipId });
  return data as JournalEntry;
}

export async function fetchLatestMoods(relationshipId: string) {
  const { data, error } = await supabase
    .from('mood_logs')
    .select('*')
    .eq('relationship_id', relationshipId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;

  const latest: Record<string, MoodLog> = {};
  for (const log of data as MoodLog[]) {
    if (!latest[log.user_id]) latest[log.user_id] = log;
  }
  return latest;
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

export async function updateMood(relationshipId: string, userId: string, mood: string) {
  const { data, error } = await supabase
    .from('mood_logs')
    .insert({ relationship_id: relationshipId, user_id: userId, mood })
    .select()
    .single();
  if (error) throw error;
  return data as MoodLog;
}

export async function fetchStreak(relationshipId: string) {
  const { data, error } = await supabase
    .from('streaks')
    .select('*')
    .eq('relationship_id', relationshipId)
    .single();
  if (error) return null;
  return data as Streak;
}

export async function fetchDailyChallenge(relationshipId: string) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('relationship_id', relationshipId)
    .eq('challenge_date', today)
    .maybeSingle();

  if (error) throw error;
  return data as DailyChallenge | null;
}

export async function respondToDailyChallenge(
  challengeId: string,
  userId: string,
  relationship: Relationship,
  response: string,
) {
  const field = relationship.user_1_id === userId ? 'user_1_response' : 'user_2_response';
  const { data, error } = await supabase
    .from('daily_challenges')
    .update({ [field]: response })
    .eq('id', challengeId)
    .select()
    .single();
  if (error) throw error;
  return data as DailyChallenge;
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

export async function fetchExperiences() {
  const { data, error } = await supabase.from('experiences').select('*').limit(20);
  if (error) throw error;
  return data as Experience[];
}

export async function fetchNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as Notification[];
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

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}

/** Upload chat media to the private `chat` bucket; returns a long-lived signed URL. */
export async function uploadChatMedia(path: string, uri: string, contentType: string) {
  const arrayBuffer = await readUriAsArrayBuffer(uri);

  const { data, error } = await supabase.storage.from('chat').upload(path, arrayBuffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;

  const { data: signed, error: signError } = await supabase.storage
    .from('chat')
    .createSignedUrl(data.path, 60 * 60 * 24 * 365 * 5);
  if (signError) throw signError;
  return signed.signedUrl;
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

  const { data: signed, error: signError } = await supabase.storage
    .from('profiles')
    .createSignedUrl(data.path, 60 * 60 * 24 * 365 * 5);
  if (signError) throw signError;
  return signed.signedUrl;
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

export async function updateRelationship(relationshipId: string, updates: Partial<Relationship>) {
  const { data, error } = await supabase
    .from('relationships')
    .update(updates)
    .eq('id', relationshipId)
    .select()
    .single();
  if (error) throw error;
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
  const { data: msg } = await supabase.from('messages').select('reactions').eq('id', messageId).single();
  const reactions: Record<string, string[]> = (msg?.reactions as Record<string, string[]>) ?? {};
  const current = reactions[emoji] ?? [];
  reactions[emoji] = current.includes(userId) ? current.filter((u) => u !== userId) : [...current, userId];
  if (reactions[emoji].length === 0) delete reactions[emoji];
  const { error } = await supabase.from('messages').update({ reactions }).eq('id', messageId);
  if (error) throw error;
}

export async function setMessagePinned(messageId: string, isPinned: boolean) {
  const { error } = await supabase.from('messages').update({ is_pinned: isPinned }).eq('id', messageId);
  if (error) throw error;
}

export async function hideMessageForUser(messageId: string, userId: string) {
  const { data: msg, error: fetchError } = await supabase
    .from('messages')
    .select('hidden_for')
    .eq('id', messageId)
    .single();
  if (fetchError) throw fetchError;

  const hidden = (msg?.hidden_for as string[] | null) ?? [];
  if (hidden.includes(userId)) return;

  const { error } = await supabase
    .from('messages')
    .update({ hidden_for: [...hidden, userId] })
    .eq('id', messageId);
  if (error) throw error;
}

export async function deleteMessageForAll(messageId: string, senderId: string) {
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
  const { data: m } = await supabase.from('moments').select('reactions').eq('id', momentId).single();
  const reactions: Record<string, string[]> = (m?.reactions as Record<string, string[]>) ?? {};
  const current = reactions[emoji] ?? [];
  reactions[emoji] = current.includes(userId) ? current.filter((u) => u !== userId) : [...current, userId];
  if (reactions[emoji].length === 0) delete reactions[emoji];
  const { error } = await supabase.from('moments').update({ reactions }).eq('id', momentId);
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
) {
  const { error } = await supabase.from('notifications').insert({
    relationship_id: relationshipId,
    user_id: partnerUserId,
    type,
    content,
  });
  if (error && !isMissingTableError(error)) throw error;
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
