import { formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Avatar, PrimaryButton } from '@/components/ui/primitives';
import { FloatingReactions } from '@/components/watch/FloatingReactions';
import { StreamingPhonePreview } from '@/components/watch/StreamingPhonePreview';
import { SyncedYouTubePlayer, type SyncedYouTubePlayerHandle, type YTPlayerState } from '@/components/watch/SyncedYouTubePlayer';
import { WatchChatTray } from '@/components/watch/WatchChatTray';
import { WatchScreen } from '@/components/watch/WatchScreen';
import { getStreamingPlatform, type StreamingPlatformId } from '@/constants/streaming-platforms';
import { WATCH_QUICK_REACTIONS } from '@/constants/watch-together';
import { useWatchPartyNudge, useWatchSessionMutations } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useStartCall } from '@/hooks/useStartCall';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { openStreamingApp } from '@/lib/streaming-platform';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { WatchSession } from '@/types/database';

const DRIFT_THRESHOLD = 0.5; // seconds
const SYNC_INTERVAL = 4000; // ms

function expectedPosition(session: WatchSession): number {
  const base = session.playback_position ?? 0;
  if (session.playback_state !== 'playing' || !session.playback_updated_at) return base;
  const elapsed = (Date.now() - new Date(session.playback_updated_at).getTime()) / 1000;
  return base + Math.max(0, elapsed);
}

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
  const [tray, setTray] = useState<'chat' | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const isHost = session.host_user_id === user?.id;
  const isYouTube = session.content_source === 'youtube' && !!session.content_id;
  const myJoined = session.ready_user_ids.includes(user?.id ?? '');
  const partnerJoined = partner ? session.ready_user_ids.includes(partner.id) : true;
  // Host enters immediately; partner sees a join screen until they tap "Join now"
  const showJoinScreen = !isHost && !myJoined;
  // Legacy countdown support for any existing setup/countdown sessions
  const lobby = !isHost && (session.status === 'setup' || session.status === 'countdown') && !myJoined;

  const playerRef = useRef<SyncedYouTubePlayerHandle>(null);
  const localTimeRef = useRef(0);
  const lastSentStateRef = useRef<string>('');

  const recentReactions = useMemo(() => [...(session.reactions ?? [])].reverse().slice(0, 6), [session.reactions]);

  // Session timer
  useEffect(() => {
    if (lobby) return;
    const started = new Date(session.created_at).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [lobby, session.created_at]);

  // Countdown -> begin watching
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

  // Non-host: apply remote playback whenever the host changes it.
  useEffect(() => {
    if (isHost || !isYouTube || session.status !== 'watching') return;
    const target = expectedPosition(session);
    if (Math.abs(localTimeRef.current - target) > DRIFT_THRESHOLD) {
      playerRef.current?.seekTo(target);
    }
    if (session.playback_state === 'playing') playerRef.current?.play();
    else playerRef.current?.pause();
  }, [isHost, isYouTube, session.status, session.playback_state, session.playback_position, session.playback_updated_at, session]);

  // Drift correction (non-host) + heartbeat (host).
  useEffect(() => {
    if (!isYouTube || session.status !== 'watching') return;
    const id = setInterval(() => {
      if (session.playback_state !== 'playing') return;
      if (isHost) {
        // Keep the extrapolation base fresh.
        setPlayback.mutate({ sessionId: session.id, state: 'playing', position: localTimeRef.current });
      } else {
        const target = expectedPosition(session);
        if (Math.abs(localTimeRef.current - target) > DRIFT_THRESHOLD) {
          playerRef.current?.seekTo(target);
          playerRef.current?.play();
        }
      }
    }, SYNC_INTERVAL);
    return () => clearInterval(id);
  }, [isHost, isYouTube, session.status, session.playback_state, session, setPlayback]);

  const handleProgress = useCallback((seconds: number) => {
    localTimeRef.current = seconds;
  }, []);

  const handlePlayerState = useCallback(
    (state: YTPlayerState, time: number) => {
      localTimeRef.current = time;
      if (!isHost) return;
      if (state === 'playing' || state === 'paused') {
        const key = `${state}-${Math.round(time)}`;
        if (key === lastSentStateRef.current) return;
        lastSentStateRef.current = key;
        setPlayback.mutate({ sessionId: session.id, state, position: time });
      }
    },
    [isHost, session.id, setPlayback],
  );

  const handleJoin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    markReady.mutate(session);
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
    if (session.platform_id) {
      await openStreamingApp(session.platform_id, session.link);
      return;
    }
    if (session.link) await Linking.openURL(session.link);
  };

  const hostTogglePlay = () => {
    if (!isHost) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = session.playback_state === 'playing' ? 'paused' : 'playing';
    if (next === 'playing') playerRef.current?.play();
    else playerRef.current?.pause();
    setPlayback.mutate({ sessionId: session.id, state: next, position: localTimeRef.current });
  };

  const hostSeek = (delta: number) => {
    if (!isHost) return;
    Haptics.selectionAsync();
    const target = Math.max(0, localTimeRef.current + delta);
    localTimeRef.current = target;
    playerRef.current?.seekTo(target);
    setPlayback.mutate({ sessionId: session.id, state: session.playback_state, position: target });
  };

  const handleEnd = () => {
    Alert.alert('End watch party?', 'This closes the session for both of you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End party',
        style: 'destructive',
        onPress: () => end.mutate(session.id, { onSuccess: () => onEnded(session.title, session.platform_id) }),
      },
    ]);
  };

  const handleVideoCall = () => requirePlus('Video calls during watch parties', () => startCall('video'));

  return (
    <WatchScreen
      title={session.title}
      onClose={onClose}
      right={
        <Pressable onPress={handleEnd} hitSlop={8}>
          <Text style={{ color: colors.error, fontWeight: '800', fontSize: 14 }}>End</Text>
        </Pressable>
      }>
      {/* Presence + timer bar */}
      <View style={[styles.statusBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.presence}>
          <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={32} />
          <View style={[
            styles.presenceDot,
            { backgroundColor: partnerJoined ? colors.success : colors.textTertiary, borderColor: colors.surface },
          ]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusTitle, { color: colors.text }]} numberOfLines={1}>
            {isYouTube ? 'YouTube' : session.platform_id ? getStreamingPlatform(session.platform_id).name : 'Watch party'}
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
            {partnerJoined ? `${partnerName} watching with you` : `${partnerName} hasn't joined yet`}
          </Text>
        </View>
        {!showJoinScreen && (
          <View style={[styles.timer, { backgroundColor: colors.surfaceElevated }]}>
            <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
            <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12 }}>{formatClock(elapsed)}</Text>
          </View>
        )}
      </View>

      {/* Partner join screen — shown until they tap "Join now" */}
      {showJoinScreen && (
        <View style={[styles.joinCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <StreamingPhonePreview
            platformId={(session.platform_id ?? 'other') as StreamingPlatformId}
            mode="watching"
            title={session.title}
            isPlaying={session.playback_state === 'playing'}
            playbackTime={formatClock(session.playback_position ?? 0)}
            size="lg"
          />
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={[styles.joinTitle, { color: colors.text }]}>{session.title}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
              {partnerName} started watching
            </Text>
          </View>
          <PrimaryButton label="Join now" onPress={handleJoin} loading={markReady.isPending} />
          <Pressable onPress={handleNudge} style={[styles.nudgeBtn, { backgroundColor: colors.accentSoft }]}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Send a nudge instead</Text>
          </Pressable>
        </View>
      )}

      {/* Host: "waiting for partner" inline nudge strip */}
      {isHost && !partnerJoined && !showJoinScreen && (
        <Pressable
          onPress={handleNudge}
          style={[styles.waitingBanner, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <View style={[styles.liveDot, { backgroundColor: colors.accent }]} />
          <Text style={{ color: colors.accent, fontWeight: '700', flex: 1, fontSize: 13 }}>
            Waiting for {partnerName} to join
          </Text>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>Nudge ›</Text>
        </Pressable>
      )}

      {!showJoinScreen && isYouTube ? (
        <>
          {/* Embedded synced player */}
          <View>
            <SyncedYouTubePlayer
              ref={playerRef}
              videoId={session.content_id!}
              controls={false}
              onProgress={handleProgress}
              onStateChange={handlePlayerState}
            />
            <FloatingReactions reactions={session.reactions ?? []} />
          </View>

          {/* Host playback controls */}
          <View style={[styles.playerControls, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.syncDot, { backgroundColor: session.playback_state === 'playing' ? colors.success : colors.warning }]} />
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
              {session.playback_state === 'playing' ? 'Playing' : 'Paused'} · in sync
            </Text>
            <View style={{ flex: 1 }} />
            {isHost ? (
              <View style={styles.hostControls}>
                <Pressable onPress={() => hostSeek(-10)} hitSlop={6} style={[styles.ctrlBtn, { backgroundColor: colors.surfaceElevated }]}>
                  <Icon name="chevronLeft" size={18} color={colors.textSecondary} />
                </Pressable>
                <Pressable onPress={hostTogglePlay} style={[styles.ctrlPlay, { backgroundColor: colors.accent }]}>
                  <Icon name={session.playback_state === 'playing' ? 'pause' : 'play'} size={20} color={colors.onAccent} />
                </Pressable>
                <Pressable onPress={() => hostSeek(10)} hitSlop={6} style={[styles.ctrlBtn, { backgroundColor: colors.surfaceElevated }]}>
                  <Icon name="chevronRight" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{partnerName} is hosting</Text>
            )}
          </View>

          {renderReactionBar()}
          {renderCommunication()}
        </>
      ) : !showJoinScreen ? (
        <>
          <StreamingPhonePreview
            platformId={(session.platform_id ?? 'other') as StreamingPlatformId}
            mode="watching"
            title={session.title}
            isPlaying={session.playback_state === 'playing'}
            playbackTime={formatClock(session.playback_position ?? 0)}
            onOpenApp={handleOpenStream}
            size="lg"
          />

          <View style={[styles.playerControls, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.syncDot, { backgroundColor: session.playback_state === 'playing' ? colors.success : colors.warning }]} />
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
              {session.playback_state === 'playing' ? 'Playing' : 'Paused'} · {formatClock(session.playback_position)}
            </Text>
            <View style={{ flex: 1 }} />
            {isHost ? (
              <View style={styles.hostControls}>
                <Pressable onPress={() => hostSeekStreaming(-15)} hitSlop={6} style={[styles.ctrlBtn, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700' }}>-15</Text>
                </Pressable>
                <Pressable onPress={hostToggleStreaming} style={[styles.ctrlPlay, { backgroundColor: colors.accent }]}>
                  <Icon name={session.playback_state === 'playing' ? 'pause' : 'play'} size={20} color={colors.onAccent} />
                </Pressable>
                <Pressable onPress={() => hostSeekStreaming(15)} hitSlop={6} style={[styles.ctrlBtn, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700' }}>+15</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{partnerName} is hosting</Text>
            )}
          </View>

          {renderReactionBar()}
          {renderCommunication()}
        </>
      ) : null}
    </WatchScreen>
  );

  function hostToggleStreaming() {
    if (!isHost) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = session.playback_state === 'playing' ? 'paused' : 'playing';
    setPlayback.mutate({ sessionId: session.id, state: next });
  }

  function hostSeekStreaming(delta: number) {
    if (!isHost) return;
    Haptics.selectionAsync();
    setPlayback.mutate({
      sessionId: session.id,
      state: session.playback_state,
      position: Math.max(0, (session.playback_position ?? 0) + delta),
    });
  }

  function renderReactionBar() {
    return (
      <View style={styles.reactBar}>
        {WATCH_QUICK_REACTIONS.map((r) => (
          <Pressable
            key={r.emoji}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              react.mutate({ session, emoji: r.emoji });
            }}
            style={[styles.reactBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={styles.reactEmoji}>{r.emoji}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  function renderCommunication() {
    return (
      <>
        <View style={styles.commRow}>
          <CommButton
            icon="chat"
            label="Chat"
            active={tray === 'chat'}
            onPress={() => setTray((t) => (t === 'chat' ? null : 'chat'))}
            colors={colors}
          />
          <CommButton icon="call" label="Voice" onPress={() => startCall('audio')} colors={colors} />
          <CommButton icon="videocam" label="Video" onPress={handleVideoCall} colors={colors} />
        </View>

        {tray === 'chat' && <WatchChatTray sessionId={session.id} />}

        {tray !== 'chat' && recentReactions.length > 0 && (
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
    );
  }
}

function CommButton({
  icon,
  label,
  active,
  onPress,
  colors,
}: {
  icon: 'chat' | 'call' | 'videocam';
  label: string;
  active?: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.commBtn,
        {
          backgroundColor: active ? colors.accent : colors.surface,
          borderColor: active ? colors.accent : colors.border,
        },
      ]}>
      <Icon name={icon} size={18} color={active ? colors.onAccent : colors.accent} filled={active} />
      <Text style={{ color: active ? colors.onAccent : colors.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}


function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = r.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const styles = StyleSheet.create({
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  presence: { width: 36, height: 36 },
  presenceDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  statusTitle: { fontSize: 15, fontWeight: '800' },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  joinCard: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 28,
    gap: 18,
    alignItems: 'center',
  },
  joinTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  waitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  nudgeBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
  nowPlaying: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  openBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  playerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  syncDot: { width: 8, height: 8, borderRadius: 4 },
  hostControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctrlBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  ctrlPlay: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  reactBar: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  reactBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reactEmoji: { fontSize: 24 },
  commRow: { flexDirection: 'row', gap: 10 },
  commBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reactFeed: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
});
