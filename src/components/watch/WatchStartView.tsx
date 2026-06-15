import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { PlatformConnectGrid } from '@/components/watch/PlatformConnectGrid';
import { WatchScreen } from '@/components/watch/WatchScreen';
import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import type { StreamingPlatformId } from '@/constants/streaming-platforms';
import { getStreamingPlatform } from '@/constants/streaming-platforms';
import { useWatchPartyNudge, useWatchSessionMutations } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { useRelationshipStore } from '@/stores';

export function WatchStartView({
  onClose,
  onBack,
  onSchedule,
}: {
  onClose: () => void;
  onBack: () => void;
  onSchedule: () => void;
}) {
  const { colors } = useTheme();
  const partner = useRelationshipStore((s) => s.partner);
  const partnerName = getFirstName(partner?.name) ?? 'Partner';

  const { create } = useWatchSessionMutations();
  const nudge = useWatchPartyNudge();
  const [platformId, setPlatformId] = useState<StreamingPlatformId | null>(null);

  const handleCreate = () => {
    if (!platformId) return;
    const platform = getStreamingPlatform(platformId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    create.mutate(
      { title: platform.name, platformId },
      { onError: () => Alert.alert('Could not start party', 'Please try again.') },
    );
  };

  const handleNudge = () => {
    if (!partner) return;
    nudge.mutate(undefined, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Nudge sent', `${partnerName} will get a notification to join you.`);
      },
      onError: () => Alert.alert('Could not nudge', 'Please try again in a moment.'),
    });
  };

  return (
    <WatchScreen title="Start watch party" onClose={onClose} onBack={onBack}>
      <Text style={[styles.lead, { color: colors.textSecondary }]}>
        Pick a streaming service. Moments syncs your start countdown and live reactions — the video plays
        in your own app.
      </Text>

      {partner && (
        <Pressable
          onPress={handleNudge}
          disabled={nudge.isPending}
          style={[styles.nudgeBanner, { borderColor: colors.border }]}>
          <Icon name="bell" size={18} color={colors.accent} />
          <Text style={[styles.nudgeText, { color: colors.textSecondary }]}>{partnerName} not here yet?</Text>
          <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 14 }}>Nudge</Text>
        </Pressable>
      )}

      <PlatformConnectGrid selectedPlatformId={platformId} onSelectPlatform={setPlatformId} />

      <PrimaryButton
        label={platformId ? `Start on ${getStreamingPlatform(platformId).name}` : 'Pick a service to start'}
        onPress={handleCreate}
        disabled={!platformId}
        loading={create.isPending}
      />

      <Pressable onPress={onSchedule} style={styles.scheduleLink}>
        <Icon name="calendar" size={16} color={colors.accent} />
        <Text style={{ color: colors.accent, fontWeight: '700' }}>Schedule for later instead</Text>
      </Pressable>
    </WatchScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 14, lineHeight: 20 },
  nudgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  nudgeText: { flex: 1, fontSize: 14 },
  scheduleLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
});
