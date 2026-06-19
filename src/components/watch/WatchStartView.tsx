import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import { StreamingPhonePreview } from '@/components/watch/StreamingPhonePreview';
import { StreamingServiceGrid } from '@/components/watch/StreamingServiceGrid';
import { WatchPageHero, watchPanelStyles } from '@/components/watch/WatchPageHero';
import { WatchScreen } from '@/components/watch/WatchScreen';
import type { StreamingPlatformId } from '@/constants/streaming-platforms';
import { getStreamingPlatform } from '@/constants/streaming-platforms';
import { useStreamingConnectionMutations, useWatchPartyNudge, useWatchSessionMutations } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { useAuthStore, useRelationshipStore } from '@/stores';

export function WatchStartView({
  onClose,
  onBack,
}: {
  onClose: () => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const partnerName = getFirstName(partner?.name) ?? 'Partner';

  const { create } = useWatchSessionMutations();
  const { connect } = useStreamingConnectionMutations();
  const nudge = useWatchPartyNudge();

  const [platformId, setPlatformId] = useState<StreamingPlatformId | null>(null);

  const handleStart = () => {
    if (!platformId) return;
    const platform = getStreamingPlatform(platformId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    create.mutate(
      {
        title: platform.name,
        platformId,
        contentSource: 'streaming',
      },
      {
        onSuccess: () => {
          connect.mutate({
            platformId,
            accountLabel: user?.email?.split('@')[0] ?? platform.name,
          });
        },
        onError: () => Alert.alert('Could not start party', 'Please try again.'),
      },
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
      <WatchPageHero
        eyebrow="START NOW"
        title="Start watch party"
        subtitle="Pick where you watch — video opens on your phone, Moments keeps you together."
        icon="play"
      />

      <View
        style={[
          watchPanelStyles.panel,
          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        ]}>
        {partner && (
          <Pressable
            onPress={handleNudge}
            disabled={nudge.isPending}
            style={[styles.nudgeBanner, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <Icon name="bell" size={16} color={colors.accent} />
            <Text style={[styles.nudgeText, { color: colors.text }]}>
              {partnerName} not here yet?
            </Text>
            <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 13 }}>Nudge</Text>
          </Pressable>
        )}

        <StreamingPhonePreview
          platformId={platformId}
          mode={platformId ? 'preview' : 'idle'}
          title={platformId ? getStreamingPlatform(platformId).name : undefined}
          size="md"
        />

        <View style={watchPanelStyles.fieldGroup}>
          <Text style={[watchPanelStyles.sectionLabel, { color: colors.textSecondary }]}>
            Streaming service
          </Text>
          <StreamingServiceGrid selectedId={platformId} onSelect={setPlatformId} iconSize={30} />
        </View>

        <PrimaryButton
          label={platformId ? `Watch ${getStreamingPlatform(platformId).name}` : 'Pick a service to start'}
          onPress={handleStart}
          disabled={!platformId}
          loading={create.isPending}
        />
      </View>
    </WatchScreen>
  );
}

const styles = StyleSheet.create({
  nudgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  nudgeText: { flex: 1, fontSize: 14, fontWeight: '600' },
});
