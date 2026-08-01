const EVENT_QUEUE: Array<{
  relationshipId: string;
  userId: string;
  eventType: string;
  metadata: Record<string, unknown>;
}> = [];

let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function track(event: {
  relationshipId: string;
  userId: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  EVENT_QUEUE.push({
    relationshipId: event.relationshipId,
    userId: event.userId,
    eventType: event.eventType,
    metadata: event.metadata ?? {},
  });

  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushEvents();
    }, 5000);
  }
}

async function flushEvents() {
  if (EVENT_QUEUE.length === 0) return;

  const batch = EVENT_QUEUE.splice(0, EVENT_QUEUE.length);
  try {
    const { supabase } = await import('@/lib/supabase');
    await supabase.from('analytics_events').insert(
      batch.map((e) => ({
        relationship_id: e.relationshipId,
        user_id: e.userId,
        event_type: e.eventType,
        metadata: e.metadata,
      })),
    );
  } catch {
    EVENT_QUEUE.unshift(...batch);
  }
}

export const AnalyticsEvents = {
  APP_OPEN: 'app_open',
  MOMENT_CREATED: 'moment_created',
  MESSAGE_SENT: 'message_sent',
  ACTIVITY_STARTED: 'activity_started',
  ACTIVITY_COMPLETED: 'activity_completed',
  CALENDAR_EVENT_CREATED: 'calendar_event_created',
  STREAK_UPDATED: 'streak_updated',
  MOOD_SELECTED: 'mood_selected',
  MOOD_VIEWED: 'mood_viewed',
  TAB_VIEWED: 'tab_viewed',
  WATCH_PARTY_CREATED: 'watch_party_created',
  WATCH_INVITATION_SENT: 'invitation_sent',
  WATCH_INVITATION_ACCEPTED: 'invitation_accepted',
  WATCH_CONTENT_ADDED: 'content_added_to_watchlist',
  WATCH_SESSION_STARTED: 'session_started',
  WATCH_SESSION_COMPLETED: 'session_completed',
  WATCH_REACTION_SENT: 'reaction_sent',
  WATCH_SCHEDULED: 'watch_party_scheduled',
} as const;
