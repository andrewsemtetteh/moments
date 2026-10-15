import * as Haptics from '@/lib/haptics';
import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { DraggableSheet } from '@/components/ui/DraggableSheet';
import { useTheme } from '@/hooks/useTheme';
import { gameRoom } from '@/lib/game-room/manager';
import { getGameDefinition } from '@/lib/game-room/types';
import { useAuthStore, useRelationshipStore } from '@/stores';
import { useGameRoomStore } from '@/stores/game-room-store';
import { usePlayProgressStore } from '@/stores/play-progress-store';

import { AchievementRelay, CelebrationHost } from './Celebration';
import { LiveRoomModal } from './LiveRoomModal';

/** Your partner opened a live session: a sheet to join (optionally muted) or pass for now. */
function InviteSheet() {
  const { colors } = useTheme();
  const invite = useGameRoomStore((s) => s.invite);
  const open = useGameRoomStore((s) => s.open);
  const room = useGameRoomStore((s) => s.state);
  const def = invite ? getGameDefinition(invite.game) : null;
  const tone = def ? PLAY_TONES[def.tone] : null;
  const inLobby = room?.phase === 'lobby';

  const join = (muted: boolean) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (muted) gameRoom.setMuted(true);
    void gameRoom.openRoom();
  };

  return (
    <DraggableSheet visible={!!invite && !open} onClose={() => gameRoom.dismissInvite()}>
      {invite && def && tone ? (
        <View style={styles.sheet}>
          <View style={[styles.liveBadge, { backgroundColor: colors.success }]}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{invite.fromName} wants to play live</Text>
          <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>They’re in the session now, with voice on.</Text>
          <View style={[styles.gameCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.gameTile, { backgroundColor: tone.accent }]}>
              <Text style={styles.gameEmoji}>{def.emoji}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.gameTitle, { color: colors.text }]}>{inLobby ? 'Picking a game' : def.title}</Text>
              <Text style={[styles.gameSub, { color: colors.textSecondary }]}>
                {inLobby ? 'You’ll choose one together inside' : 'You can switch game inside'}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => join(false)}
            accessibilityRole="button"
            style={[styles.joinBtn, { backgroundColor: colors.accent }]}>
            <Text style={[styles.joinText, { color: colors.onAccent }]}>Join</Text>
          </Pressable>
          <View style={styles.secondaryRow}>
            <Pressable onPress={() => join(true)} accessibilityRole="button" style={styles.secondaryBtn}>
              <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Join muted</Text>
            </Pressable>
            <Pressable onPress={() => gameRoom.dismissInvite()} accessibilityRole="button" style={styles.secondaryBtn}>
              <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Not now</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </DraggableSheet>
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
      <InviteSheet />
      <CelebrationHost surface="root" />
      <AchievementRelay />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { alignItems: 'center', gap: 8, paddingBottom: 8 },
  liveBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 4 },
  liveBadgeText: { color: '#14100D', fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  sheetTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
  sheetSub: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  gameCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 8,
  },
  gameTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  gameEmoji: { fontSize: 22 },
  gameTitle: { fontSize: 15, fontWeight: '800' },
  gameSub: { fontSize: 12, fontWeight: '600' },
  joinBtn: { alignSelf: 'stretch', height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  joinText: { fontSize: 17, fontWeight: '800' },
  secondaryRow: { alignSelf: 'stretch', flexDirection: 'row' },
  secondaryBtn: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '700' },
});
