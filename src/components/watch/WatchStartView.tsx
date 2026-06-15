import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PlatformConnectGrid } from '@/components/watch/PlatformConnectGrid';
import { WatchScreen } from '@/components/watch/WatchScreen';
import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import type { StreamingPlatformId } from '@/constants/streaming-platforms';
import { getStreamingPlatform } from '@/constants/streaming-platforms';
import { useWatchPartyNudge, useWatchSessionMutations } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { parseYouTubeId, youTubeThumbnail } from '@/lib/youtube';
import { useRelationshipStore } from '@/stores';

type Mode = 'inapp' | 'streaming';

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

  const [mode, setMode] = useState<Mode>('inapp');
  const [platformId, setPlatformId] = useState<StreamingPlatformId | null>(null);
  const [url, setUrl] = useState('');

  const youTubeId = parseYouTubeId(url);

  const handleStartInApp = () => {
    if (!youTubeId) {
      Alert.alert('Paste a YouTube link', 'Add a YouTube video URL to watch together in the app.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    create.mutate(
      { title: 'YouTube video', contentSource: 'youtube', contentId: youTubeId, link: url.trim() },
      { onError: () => Alert.alert('Could not start party', 'Please try again.') },
    );
  };

  const handleStartStreaming = () => {
    if (!platformId) return;
    const platform = getStreamingPlatform(platformId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    create.mutate(
      { title: platform.name, platformId, contentSource: 'streaming' },
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
      {/* Mode switch */}
      <View style={[styles.segment, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <SegmentButton
          label="Watch in app"
          icon="play"
          active={mode === 'inapp'}
          onPress={() => setMode('inapp')}
          colors={colors}
        />
        <SegmentButton
          label="Streaming app"
          icon="film"
          active={mode === 'streaming'}
          onPress={() => setMode('streaming')}
          colors={colors}
        />
      </View>

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

      {mode === 'inapp' ? (
        <>
          <Text style={[styles.lead, { color: colors.textSecondary }]}>
            Paste a YouTube link. The video plays inside the app, perfectly synced for both of you — play,
            pause, and seek stay together.
          </Text>

          <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: youTubeId ? colors.success : colors.border }]}>
            <Icon name="globe" size={18} color={colors.textTertiary} />
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="https://youtube.com/watch?v=…"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[styles.input, { color: colors.text }]}
            />
            {youTubeId && <Icon name="check" size={18} color={colors.success} />}
          </View>

          {youTubeId && (
            <View style={[styles.preview, { borderColor: colors.border }]}>
              <Image source={{ uri: youTubeThumbnail(youTubeId) }} style={styles.thumb} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>Ready to sync</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>YouTube · plays in app</Text>
              </View>
            </View>
          )}

          <PrimaryButton
            label="Start synced party"
            onPress={handleStartInApp}
            disabled={!youTubeId}
            loading={create.isPending}
          />
        </>
      ) : (
        <>
          <Text style={[styles.lead, { color: colors.textSecondary }]}>
            For Netflix, Disney+ and others, Moments syncs your countdown, chat, calls and reactions while
            the video plays in each of your own apps.
          </Text>

          <PlatformConnectGrid selectedPlatformId={platformId} onSelectPlatform={setPlatformId} />

          <PrimaryButton
            label={platformId ? `Start on ${getStreamingPlatform(platformId).name}` : 'Pick a service to start'}
            onPress={handleStartStreaming}
            disabled={!platformId}
            loading={create.isPending}
          />
        </>
      )}

      <Pressable onPress={onSchedule} style={styles.scheduleLink}>
        <Icon name="calendar" size={16} color={colors.accent} />
        <Text style={{ color: colors.accent, fontWeight: '700' }}>Schedule for later instead</Text>
      </Pressable>
    </WatchScreen>
  );
}

function SegmentButton({
  label,
  icon,
  active,
  onPress,
  colors,
}: {
  label: string;
  icon: 'play' | 'film';
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentBtn, active && { backgroundColor: colors.accent }]}>
      <Icon name={icon} size={16} color={active ? colors.onAccent : colors.textSecondary} filled={active} />
      <Text style={{ color: active ? colors.onAccent : colors.textSecondary, fontWeight: '800', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
  },
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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 15 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 80, height: 45, borderRadius: 8, backgroundColor: '#000' },
  scheduleLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
});
