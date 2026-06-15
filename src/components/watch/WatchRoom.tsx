import { formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { StreamingPlatformIcon } from '@/components/watch/StreamingPlatformIcon';
import { WatchScreen } from '@/components/watch/WatchScreen';
import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import { getStreamingPlatform } from '@/constants/streaming-platforms';
import { WATCH_QUICK_REACTIONS } from '@/constants/watch-together';
import { useWatchPartyNudge, useWatchSessionMutations } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useStartCall } from '@/hooks/useStartCall';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { openStreamingSignIn } from '@/lib/streaming-platform';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { WatchSession } from '@/types/database';

export function WatchRoom({
  session,
  onClose,
  onEnded,
}: {
  session: WatchSession;
  onClose: () => void;
  onEnded: (title: string, platformId: string | null) => void;
}) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const partnerName = getFirstName(partner?.name) ?? 'Partner';

  const { markReady, startCountdown, beginWatching, setPlayback, react, end } = useWatchSessionMutations();
  const nudge = useWatchPartyNudge();
  const startCall = useStartCall();
  const { requirePlus } = usePlusGate();

  const [countdown, setCountdown] = useState<number | null>(null);

  const isHost = session.host_user_id === user?.id;
  const myReady = session.ready_user_ids.includes(user?.id ?? '');
  const partnerReady = partner ? session.ready_user_ids.includes(partner.id) : false;

  const recentReactions = useMemo(() => [...(session.reactions ?? [])].reverse().slice(0, 8), [session.reactions]);

  useEffect(() => {
    if (!session.countdown_at || session.status !== 'countdown') {
      setCountdown(null);
      return;
    }
    const tick = () => {
      const ms = new Date(session.countdown_at!).getTime() - Date.now();
      const secs = Math.max(0, Math.ceil(ms / 1000));
      setCountdown(secs);
      if (secs <= 0 && isHost) beginWatching.mutate(session.id);
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [session.countdown_at, session.status, session.id, isHost, beginWatching]);

  const handleMarkReady = () => {
    markReady.mutate(session, {
      onSuccess: (updated) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const ids = updated.ready_user_ids ?? [];
        const allReady = partner ? ids.includes(partner.id) && ids.includes(user!.id) : ids.includes(user!.id);
        if (allReady && session.status === 'setup' && isHost) startCountdown.mutate(session.id);
      },
    });
  };

  const handleNudge = () => {
    if (!partner) return;
    nudge.mutate(undefined, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Nudge sent', `${partnerName} will get a notification.`);
      },
    });
  };

  const handleOpenStream = async () => {
    if (session.platform_id) return openStreamingSignIn(session.platform_id);
    if (session.link) await Linking.openURL(session.link);
  };

  const togglePlayback = () => {
    if (!isHost) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPlayback.mutate({
      sessionId: session.id,
      state: session.playback_state === 'playing' ? 'paused' : 'playing',
    });
  };

  const seek = (delta: number) => {
    if (!isHost) return;
    Haptics.selectionAsync();
    setPlayback.mutate({
      sessionId: session.id,
      state: session.playback_state,
      position: Math.max(0, (session.playback_position ?? 0) + delta),
    });
  };

  const handleEnd = () => {
    Alert.alert('End watch party?', 'This closes the session for both of you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End party',
        style: 'destructive',
        onPress: () =>
          end.mutate(session.id, {
            onSuccess: () => onEnded(session.title, session.platform_id),
          }),
      },
    ]);
  };

  const handleVideoCall = () => {
    requirePlus('Video calls during watch parties', () => startCall('video'));
  };

  const lobby = session.status === 'setup' || session.status === 'countdown';

  return (
    <WatchScreen
      title={session.title}
      onClose={onClose}
      right={
        <Pressable onPress={handleEnd} hitSlop={8}>
          <Text style={{ color: colors.error, fontWeight: '800', fontSize: 14 }}>End</Text>
        </Pressable>
      }>
      {/* Room status header */}
      <View style={[styles.statusBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <StreamingPlatformIcon platformId={session.platform_id ?? 'other'} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusTitle, { color: colors.text }]} numberOfLines={1}>
            {session.platform_id ? getStreamingPlatform(session.platform_id).name : 'Watch party'}
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
            {lobby ? 'Getting ready' : 'Live'} · started {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
          </Text>
        </View>
        <View style={[styles.liveDot, { backgroundColor: lobby ? colors.warning : colors.success }]} />
      </View>

      {lobby ? (
        <View style={[styles.lobby, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.readyRow}>
            <ReadyPill label="You" ready={myReady} colors={colors} />
            {partner && <ReadyPill label={partnerName} ready={partnerReady} colors={colors} />}
          </View>

          {!myReady && <PrimaryButton label="I'm ready" onPress={handleMarkReady} loading={markReady.isPending} />}

          {myReady && partner && !partnerReady && session.status === 'setup' && (
            <>
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                Waiting for {partnerName} to get ready…
              </Text>
              <Pressable onPress={handleNudge} style={[styles.nudgeBtn, { backgroundColor: colors.accentSoft }]}>
                <Text style={{ color: colors.accent, fontWeight: '700' }}>Nudge {partnerName}</Text>
              </Pressable>
            </>
          )}

          {session.status === 'countdown' && countdown !== null && (
            <View style={styles.countdownWrap}>
              <Text style={[styles.countdownLabel, { color: colors.textSecondary }]}>Press play in</Text>
              <Text style={[styles.countdownNum, { color: colors.accent }]}>{countdown}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Open your app and hit play together</Text>
            </View>
          )}
        </View>
      ) : (
        <>
          {/* Now playing + open */}
          <View style={[styles.nowPlaying, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="film" size={28} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: colors.text }]}>{session.title}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Plays in your streaming app</Text>
            </View>
            <Pressable onPress={handleOpenStream} style={[styles.openBtn, { backgroundColor: colors.accent }]}>
              <Icon name="play" size={18} color={colors.onAccent} />
            </Pressable>
          </View>

          {/* Sync / playback controls */}
          <View style={[styles.syncBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.syncHead}>
              <View style={[styles.syncDot, { backgroundColor: session.playback_state === 'playing' ? colors.success : colors.warning }]} />
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {session.playback_state === 'playing' ? 'Playing' : 'Paused'} · {formatPos(session.playback_position)}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 'auto' }}>
                {isHost ? 'You host' : `${partnerName} hosts`}
              </Text>
            </View>

            <View style={styles.controls}>
              <ControlBtn icon="chevronLeft" label="-15s" disabled={!isHost} onPress={() => seek(-15)} colors={colors} />
              <Pressable
                onPress={togglePlayback}
                disabled={!isHost}
                style={[styles.playBtn, { backgroundColor: isHost ? colors.accent : colors.surfaceElevated, opacity: isHost ? 1 : 0.6 }]}>
                <Icon
                  name={session.playback_state === 'playing' ? 'pause' : 'play'}
                  size={26}
                  color={isHost ? colors.onAccent : colors.textSecondary}
                />
              </Pressable>
              <ControlBtn icon="chevronRight" label="+15s" disabled={!isHost} onPress={() => seek(15)} colors={colors} />
            </View>
            {!isHost && (
              <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center' }}>
                {partnerName} controls playback — your screen stays in sync.
              </Text>
            )}
          </View>

          {/* Communication */}
          <View style={styles.callRow}>
            <Pressable onPress={() => startCall('audio')} style={[styles.callBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Icon name="call" size={18} color={colors.accent} />
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>Voice call</Text>
            </Pressable>
            <Pressable onPress={handleVideoCall} style={[styles.callBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Icon name="videocam" size={18} color={colors.accent} />
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>Video call</Text>
            </Pressable>
          </View>

          {/* Quick reactions */}
          <Text style={[styles.reactLabel, { color: colors.text }]}>Quick reactions</Text>
          <View style={styles.reactRow}>
            {WATCH_QUICK_REACTIONS.map((r) => (
              <Pressable
                key={r.emoji}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  react.mutate({ session, emoji: r.emoji });
                }}
                style={[styles.reactBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Text style={styles.reactEmoji}>{r.emoji}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '600' }} numberOfLines={1}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {recentReactions.length > 0 && (
            <View style={[styles.reactFeed, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {recentReactions.map((r, i) => (
                <Text key={`${r.at}-${i}`} style={{ color: colors.textSecondary, fontSize: 14 }}>
                  {r.emoji} {r.user_id === user?.id ? 'You' : partnerName}{' '}
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                    {formatDistanceToNow(new Date(r.at), { addSuffix: true })}
                  </Text>
                </Text>
              ))}
            </View>
          )}
        </>
      )}
    </WatchScreen>
  );
}

function ControlBtn({
  icon,
  label,
  disabled,
  onPress,
  colors,
}: {
  icon: 'chevronLeft' | 'chevronRight';
  label: string;
  disabled?: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.controlBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, opacity: disabled ? 0.5 : 1 }]}>
      <Icon name={icon} size={18} color={colors.textSecondary} />
      <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function ReadyPill({
  label,
  ready,
  colors,
}: {
  label: string;
  ready: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View
      style={[
        styles.readyPill,
        {
          backgroundColor: ready ? colors.success + '22' : colors.surfaceElevated,
          borderColor: ready ? colors.success : colors.border,
        },
      ]}>
      <Icon name={ready ? 'check' : 'film'} size={16} color={ready ? colors.success : colors.textSecondary} />
      <Text style={{ color: ready ? colors.success : colors.textSecondary, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function formatPos(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusTitle: { fontSize: 16, fontWeight: '800' },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  lobby: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20, gap: 14, alignItems: 'center' },
  readyRow: { flexDirection: 'row', gap: 10 },
  readyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  nudgeBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
  countdownWrap: { alignItems: 'center', gap: 4, marginTop: 4 },
  countdownLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  countdownNum: { fontSize: 64, fontWeight: '900', lineHeight: 72 },
  nowPlaying: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  openBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  syncBox: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 14 },
  syncHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  syncDot: { width: 8, height: 8, borderRadius: 4 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  controlBtn: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  playBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  callRow: { flexDirection: 'row', gap: 10 },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reactLabel: { fontSize: 16, fontWeight: '800' },
  reactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reactBtn: {
    width: 64,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reactEmoji: { fontSize: 24 },
  reactFeed: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
});
