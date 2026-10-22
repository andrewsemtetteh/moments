import * as Haptics from '@/lib/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { firstName, shade } from '@/components/games/room-ui';
import { gameRoom } from '@/lib/game-room/manager';
import { useIsPlus } from '@/hooks/useIsPlus';
import { requirePlusNow } from '@/lib/plus';
import { Crown } from '@/components/ui/Crown';
import { getGameDefinition, type LiveGameKind } from '@/lib/game-room/types';
import { useAuthStore, useRelationshipStore } from '@/stores';
import { useGameRoomStore } from '@/stores/game-room-store';

/**
 * Go live: rejoin a session that's already running, or (nothing running) pick a game to play live;
 * its page starts the session and invites your partner.
 */
export function goLive() {
  const { state } = useGameRoomStore.getState();
  if (state && state.phase !== 'finished') {
    openLiveSession();
    return;
  }
  // Locked without Plus: the Plus page instead of the games.
  if (!requirePlusNow('Live games')) return;
  void Haptics.selectionAsync();
  router.push('/play/live');
}

/**
 * Opens the live room (voice on) at its lobby, where you set the vibe and rounds and your partner is
 * invited; or rejoins one already running. `game`: the room opens with that game chosen.
 */
export function openLiveSession(game?: LiveGameKind) {
  const { partner } = useRelationshipStore.getState();
  if (!partner) {
    Alert.alert('Connect with your partner', 'Live sessions are for two. Link up with your partner first.');
    return;
  }
  // Live games are written by AI: Plus (or its free trial).
  if (!requirePlusNow('Live games')) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  void gameRoom.openRoom(game);
}

function usePulse() {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.7, { duration: 800 }), withTiming(1, { duration: 800 })), -1);
  }, [pulse]);
  return useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: 2.2 - pulse.value }));
}

/** The live session card: purple when idle, the game's colour when your partner is waiting. */
export function LiveStrip() {
  const meId = useAuthStore((s) => s.user?.id);
  const partner = useRelationshipStore((s) => s.partner);
  const partnerOnline = useGameRoomStore((s) => s.partnerOnline);
  const room = useGameRoomStore((s) => s.state);
  const pulseStyle = usePulse();
  const isPlus = useIsPlus();
  const name = firstName(partner?.name);

  const live = !!room && room.phase !== 'finished';
  const joinable = live && room.hostId !== meId;
  const roomTone = room ? PLAY_TONES[getGameDefinition(room.game).tone] : null;

  const badge = joinable ? 'Live now' : live ? 'Your session' : partnerOnline ? `${name} is online` : 'Live session';
  const title = joinable ? `${name} is waiting for you` : live ? 'Your session is open' : 'Play together live';
  const cta = joinable ? 'Join' : live ? 'Return' : 'Go live';

  return (
    <Pressable
      onPress={goLive}
      accessibilityRole="button"
      accessibilityLabel={`${cta}. ${title}`}
      style={({ pressed }) => [pressed && { transform: [{ scale: 0.985 }] }]}>
      <LinearGradient
        colors={joinable && roomTone ? [roomTone.accent, shade(roomTone.accent, -0.3)] : ['#6C4DFF', '#B14DFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}>
        <View style={styles.glow} pointerEvents="none" />
        {/* Live games are Plus: marked until you have it. */}
        {!isPlus ? (
          <View style={styles.lock} pointerEvents="none">
            <Crown size={15} color="#3A2A00" />
            <Text style={styles.lockText}>PLUS</Text>
          </View>
        ) : null}
        <View style={styles.badge}>
          <View style={styles.dotWrap}>
            {joinable || partnerOnline ? <Animated.View style={[styles.halo, pulseStyle]} /> : null}
            <View style={styles.dot} />
          </View>
          <Text style={styles.badgeText}>{badge.toUpperCase()}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        {joinable && room ? <Text style={styles.sub}>{getGameDefinition(room.game).title} · with voice</Text> : null}
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{cta}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 28, padding: 20, gap: 8, overflow: 'hidden' },
  glow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.13)',
    right: -70,
    top: -80,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A5F' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A5F' },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.4, marginTop: 4 },
  sub: { color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: '600' },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },
  ctaText: { color: '#3B2BB0', fontSize: 15, fontWeight: '900' },
  lock: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFD54A',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  lockText: { color: '#3A2A00', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
});
