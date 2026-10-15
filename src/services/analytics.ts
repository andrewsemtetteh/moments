const EVENT_QUEUE: {
  relationshipId: string;
  userId: string;
  eventType: string;
  metadata: Record<string, unknown>;
}[] = [];

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
    const { backend } = await import('@/lib/backend');
    await backend.from('analytics_events').insert(
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
  // Moments Plus funnel (see src/docs/MONETIZATION.md).
  PAYWALL_VIEWED: 'paywall_viewed',
  PAYWALL_CLOSED: 'paywall_closed',
  TRIAL_STARTED: 'trial_started',
  PURCHASED: 'purchased',
  PARTNER_JOINED: 'partner_joined',
  /** "Send it to Sam" on the paywall. */
  PAYWALL_SENT_TO_PARTNER: 'paywall_sent_to_partner',
} as const;

/** Logs an event for the signed in user's couple (skipped before a couple exists). */
export async function trackForCouple(eventType: string, metadata?: Record<string, unknown>) {
  const { useAuthStore, useRelationshipStore } = await import('@/stores');
  const userId = useAuthStore.getState().user?.id;
  const relationshipId = useRelationshipStore.getState().relationship?.id;
  if (!userId || !relationshipId) return;
  track({ relationshipId, userId, eventType, metadata });
}
