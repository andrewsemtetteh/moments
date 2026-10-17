import { differenceInCalendarDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { MOOD_EMOJI, MOOD_LABELS } from '@/constants/design-system';
import { useMoments, useMoods, useStreak } from '@/hooks/queries';
import { getRelationshipAnniversaryDate } from '@/lib/anniversary';
import { getFirstName } from '@/lib/avatar-initial';
import { signMomentsMediaUrl } from '@/lib/moment-media';
import { publishWidgetSnapshot } from '@/lib/widget-data';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { Moment } from '@/types/database';

/**
 * Keeps the home-screen widgets current: days together, your streak, their
 * latest photo moment and mood. Mounted with the tabs, so it runs while the
 * app is in use; iOS keeps showing the last snapshot in between.
 */
export function WidgetSync() {
  const user = useAuthStore((s) => s.user);
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const { data: streak } = useStreak();
  const { data: momentsData } = useMoments();
  const { data: moods } = useMoods();
  // Their newest photo moment (videos and text have no still to show).
  const partnerId = partner?.id;
  const all = (momentsData?.pages.flat() ?? []) as Moment[];
  const latest: Moment | null =
    (partnerId && all.find((m) => m.user_id === partnerId && m.type === 'photo' && !!m.media_url)) || null;

  // A small, public copy of the photo for the widget to download.
  const mediaUrl = latest?.media_url ?? null;
  const { data: imageUrl = null } = useQuery({
    queryKey: ['widget-image', mediaUrl],
    queryFn: () => signMomentsMediaUrl(mediaUrl!, 'display'),
    enabled: !!mediaUrl,
    staleTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    const paired = !!user && !!relationship && relationship.status !== 'ended' && !!partner;
    const since = relationship ? getRelationshipAnniversaryDate(relationship) : null;
    const partnerMood = partner?.id ? moods?.[partner.id]?.mood ?? null : null;
    publishWidgetSnapshot({
      partnerName: getFirstName(partner?.name) ?? '',
      daysTogether: since ? Math.max(0, differenceInCalendarDays(new Date(), since)) : 0,
      since: since ? since.toISOString() : null,
      streak: streak?.current_streak ?? 0,
      // Your streak is safe once you've checked in today.
      streakSafeToday: !!streak?.user_active_today,
      momentImageUrl: mediaUrl ? imageUrl : null,
      momentCaption: latest?.content?.trim() || null,
      momentAt: latest?.created_at ?? null,
      partnerMoodEmoji: partnerMood ? (MOOD_EMOJI[partnerMood] ?? null) : null,
      partnerMoodLabel: partnerMood ? (MOOD_LABELS[partnerMood] ?? null) : null,
      paired,
    });
  }, [user, relationship, partner, streak, mediaUrl, latest?.content, latest?.created_at, imageUrl, moods]);

  return null;
}
