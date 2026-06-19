import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { StreamingServiceGrid } from '@/components/watch/StreamingServiceGrid';
import { StreamingPlatformIcon } from '@/components/watch/StreamingPlatformIcon';
import {
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
  hideHeader?: boolean;
  /** pick = start/schedule flow (no sign-in). manage = profile-style service linking. */
  mode?: 'pick' | 'manage';
};

export function PlatformConnectGrid({
  selectedPlatformId,
  onSelectPlatform,
  compact = false,
  hideHeader = false,
  mode = 'pick',
}: Props) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const { data: connections } = useWatchPartyConnections();
  const { connect } = useStreamingConnectionMutations();

  const mineIds = new Set((connections?.mine ?? []).map((c) => c.platform_id));
  const partnerIds = new Set((connections?.partner ?? []).map((c) => c.platform_id));

  const selectedPlatform = selectedPlatformId ? getStreamingPlatform(selectedPlatformId) : null;
  const selectedConnected = selectedPlatformId ? mineIds.has(selectedPlatformId) : false;

  const handleAddService = (platformId: StreamingPlatformId) => {
    const platform = getStreamingPlatform(platformId);
    if (mineIds.has(platformId)) return;

    Alert.alert(
      `Add ${platform.name}?`,
      'This tells your partner which services you use. Sign in happens in the app on your phone — not here.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open app to sign in',
          onPress: async () => {
            await openStreamingSignIn(platformId);
          },
        },
        {
          text: 'Already signed in',
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
      {!hideHeader && (
        <>
          <Text style={[styles.heading, { color: colors.text }]}>Pick your streaming service</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {mode === 'pick'
              ? 'Video plays in the app on your phone. Moments handles chat and reactions.'
              : 'Link services you use so your partner knows what you have.'}
          </Text>
        </>
      )}

      <StreamingServiceGrid
        selectedId={selectedPlatformId}
        onSelect={onSelectPlatform}
        onLongPress={mode === 'manage' ? handleAddService : undefined}
        iconSize={compact ? 26 : 30}
        renderBadge={(platform) => {
          const connected = mineIds.has(platform.id);
          const partnerHas = partnerIds.has(platform.id);
          return (
            <>
              {connected && (
                <View style={[styles.badge, { backgroundColor: colors.success }]}>
                  <Icon name="check" size={10} color="#fff" />
                </View>
              )}
              {partnerHas && !connected && (
                <View style={[styles.partnerDot, { backgroundColor: colors.accent }]} />
              )}
            </>
          );
        }}
      />

      {mode === 'manage' && selectedPlatformId && !selectedConnected && (
        <Pressable
          onPress={() => handleAddService(selectedPlatformId)}
          style={[styles.connectBtn, { backgroundColor: colors.accentSoft }]}>
          <Icon name="plus" size={18} color={colors.accent} />
          <Text style={[styles.connectText, { color: colors.accent }]}>
            Add {getStreamingPlatform(selectedPlatformId).name} to my services
          </Text>
        </Pressable>
      )}

      {mode === 'manage' && selectedPlatformId && selectedConnected && (
        <View style={[styles.hintCard, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <Icon name="check" size={16} color={colors.accent} />
          <Text style={[styles.hintText, { color: colors.text }]}>
            {selectedPlatform?.name} is on your profile. No need to connect again.
          </Text>
        </View>
      )}

      {partner && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.partnerRow}>
          <Text style={[styles.partnerLabel, { color: colors.textTertiary }]}>
            {partner.name?.split(' ')[0] ?? 'Partner'} uses:{' '}
          </Text>
          {(connections?.partner ?? []).length === 0 ? (
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Not added yet</Text>
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
  wrap: { gap: 10, width: '100%' },
  heading: { fontSize: 17, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18 },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hintText: { flex: 1, fontSize: 13, lineHeight: 18 },
  badge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerDot: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 7,
    height: 7,
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
