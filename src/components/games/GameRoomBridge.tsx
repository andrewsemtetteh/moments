import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { useTheme } from '@/hooks/useTheme';
import { gameRoom } from '@/lib/game-room/manager';
import { getGameDefinition } from '@/lib/game-room/types';
import { useAuthStore, useRelationshipStore } from '@/stores';
import { useGameRoomStore } from '@/stores/game-room-store';
import { usePlayProgressStore } from '@/stores/play-progress-store';

import { CelebrationHost } from './Celebration';
import { LiveRoomModal } from './LiveRoomModal';

function InviteBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const invite = useGameRoomStore((s) => s.invite);
  const open = useGameRoomStore((s) => s.open);

  if (!invite || open) return null;
  const def = getGameDefinition(invite.game);
  const tone = PLAY_TONES[def.tone];

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 8 }]}>
      <Animated.View
        entering={FadeInUp.springify().damping(14)}
        exiting={FadeOutUp.duration(180)}
        style={[styles.banner, { backgroundColor: colors.surfaceElevated, borderColor: tone.accent }]}>
        <Text style={styles.bannerEmoji}>{def.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.text }]} numberOfLines={1}>
            {invite.fromName} is playing live 🎧
          </Text>
          <Text style={[styles.bannerSub, { color: colors.textSecondary }]} numberOfLines={1}>
            {def.title} · join with voice
          </Text>
        </View>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            void gameRoom.openRoom();
          }}
          accessibilityRole="button"
          accessibilityLabel="Join live game"
          style={[styles.joinBtn, { backgroundColor: tone.accent }]}>
          <Text style={styles.joinText}>Join</Text>
        </Pressable>
        <Pressable onPress={() => gameRoom.dismissInvite()} hitSlop={10} accessibilityLabel="Dismiss invite">
          <Text style={[styles.dismiss, { color: colors.textTertiary }]}>✕</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/**
 * App-level glue for live games and progression:
 * keeps the room channel attached while a couple is linked, loads shared XP, surfaces invites,
 * and hosts the room UI + celebration overlays.
 */
export function GameRoomBridge() {
  const user = useAuthStore((s) => s.user);
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const notice = useGameRoomStore((s) => s.notice);
  const open = useGameRoomStore((s) => s.open);

  const userId = user?.id;
  const userName = user?.name ?? 'You';
  const partnerId = partner?.id;
  const partnerName = partner?.name ?? 'Partner';
  const relationshipId = relationship?.id;

  useEffect(() => {
    if (!userId || !partnerId || !relationshipId) {
      void gameRoom.detach();
      return;
    }
    gameRoom.attach(relationshipId, { id: userId, name: userName }, { id: partnerId, name: partnerName });
  }, [userId, userName, partnerId, partnerName, relationshipId]);

  useEffect(() => {
    if (!relationshipId) {
      usePlayProgressStore.getState().clear();
      return;
    }
    void usePlayProgressStore.getState().load(relationshipId);
  }, [relationshipId]);

  useEffect(() => {
    return () => {
      void gameRoom.detach();
    };
  }, []);

  useEffect(() => {
    if (notice && !open) {
      Alert.alert('Live room', notice);
      useGameRoomStore.setState({ notice: null });
    }
  }, [notice, open]);

  return (
    <>
      <LiveRoomModal />
      <InviteBanner />
      <CelebrationHost surface="root" />
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
    borderWidth: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  bannerEmoji: { fontSize: 28 },
  bannerTitle: { fontSize: 15, fontWeight: '900' },
  bannerSub: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  joinBtn: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  joinText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  dismiss: { fontSize: 16, fontWeight: '800', paddingHorizontal: 4 },
});
