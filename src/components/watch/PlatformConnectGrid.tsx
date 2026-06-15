import * as Haptics from 'expo-haptics';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { StreamingPlatformIcon } from '@/components/watch/StreamingPlatformIcon';
import { Icon } from '@/components/ui/Icon';
import {
  STREAMING_PLATFORMS,
  getStreamingPlatform,
  type StreamingPlatformId,
} from '@/constants/streaming-platforms';
import { useStreamingConnectionMutations, useWatchPartyConnections } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { openStreamingSignIn } from '@/lib/streaming-platform';
import { useAuthStore, useRelationshipStore } from '@/stores';

type Props = {
  selectedPlatformId: StreamingPlatformId | null;
  onSelectPlatform: (id: StreamingPlatformId) => void;
  compact?: boolean;
};

export function PlatformConnectGrid({ selectedPlatformId, onSelectPlatform, compact = false }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const { data: connections } = useWatchPartyConnections();
  const { connect } = useStreamingConnectionMutations();

  const cols = compact ? 4 : width > 380 ? 4 : 3;
  const tileSize = (width - 48 - (cols - 1) * 10) / cols;

  const mineIds = new Set((connections?.mine ?? []).map((c) => c.platform_id));
  const partnerIds = new Set((connections?.partner ?? []).map((c) => c.platform_id));

  const handlePlatformPress = (platformId: StreamingPlatformId) => {
    onSelectPlatform(platformId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleConnect = async (platformId: StreamingPlatformId) => {
    const platform = getStreamingPlatform(platformId);
    Alert.alert(
      `Connect ${platform.name}`,
      'Sign in on their website, then come back and confirm you are connected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open sign in',
          onPress: async () => {
            await openStreamingSignIn(platformId);
          },
        },
        {
          text: "I'm signed in",
          onPress: () => {
            connect.mutate({
              platformId,
              accountLabel: user?.email?.split('@')[0] ?? platform.name,
            });
          },
        },
      ],
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colors.text }]}>Pick your streaming service</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        Open your app externally. Moments syncs the countdown and reactions, not the video.
      </Text>

      <View style={[styles.grid, { gap: 10 }]}>
        {STREAMING_PLATFORMS.map((platform) => {
          const selected = selectedPlatformId === platform.id;
          const connected = mineIds.has(platform.id);
          const partnerHas = partnerIds.has(platform.id);

          return (
            <Pressable
              key={platform.id}
              onPress={() => handlePlatformPress(platform.id)}
              onLongPress={() => handleConnect(platform.id)}
              style={[
                styles.tile,
                {
                  width: tileSize,
                  backgroundColor: selected ? colors.accentSoft : 'transparent',
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}>
              <StreamingPlatformIcon platformId={platform.id} size={compact ? 36 : 40} />
              <Text style={[styles.tileLabel, { color: colors.text }]} numberOfLines={1}>
                {platform.name}
              </Text>
              {connected && (
                <View style={[styles.badge, { backgroundColor: colors.success }]}>
                  <Icon name="check" size={10} color="#fff" />
                </View>
              )}
              {partnerHas && !connected && (
                <View style={[styles.partnerDot, { backgroundColor: colors.accent }]} />
              )}
            </Pressable>
          );
        })}
      </View>

      {selectedPlatformId && (
        <Pressable
          onPress={() => handleConnect(selectedPlatformId)}
          style={[styles.connectBtn, { backgroundColor: colors.accentSoft }]}>
          <Icon name="globe" size={18} color={colors.accent} />
          <Text style={[styles.connectText, { color: colors.accent }]}>
            Connect {getStreamingPlatform(selectedPlatformId).name}
          </Text>
        </Pressable>
      )}

      {partner && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.partnerRow}>
          <Text style={[styles.partnerLabel, { color: colors.textTertiary }]}>
            {partner.name?.split(' ')[0] ?? 'Partner'} uses:{' '}
          </Text>
          {(connections?.partner ?? []).length === 0 ? (
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Not connected yet</Text>
          ) : (
            (connections?.partner ?? []).map((c) => (
              <View key={c.id} style={[styles.partnerChip, { backgroundColor: colors.surfaceElevated }]}>
                <StreamingPlatformIcon platformId={c.platform_id} size={16} />
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {getStreamingPlatform(c.platform_id).name}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  heading: { fontSize: 17, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 8,
  },
  tileLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerDot: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  connectText: { fontWeight: '700', fontSize: 14 },
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  partnerLabel: { fontSize: 13, fontWeight: '600' },
  partnerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
});
