/* eslint-disable @typescript-eslint/no-unused-vars -- reactions and reply are commented out below, kept for when they return */
import { formatDistanceToNowStrict } from 'date-fns';
import * as Haptics from '@/lib/haptics';
import { Image } from 'expo-image';
import { mediaSource } from '@/lib/storage-cdn';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { TextInput } from '@/components/ui/ThemedTextInput';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { MomentVideoPlayer } from '@/components/moments/MomentVideoPlayer';
import { Icon } from '@/components/ui/Icon';
import { Avatar, cardEdge, cardSurface } from '@/components/ui/primitives';
import { useMomentReaction, useSendMessage } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { LOCKET_EXTRA_EMOJIS, getUserReactionEmoji, toggleMomentReactionForUser } from '@/lib/moment-display';
import { momentToReplyContext } from '@/lib/moment-reply';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import { useContentWidth } from '@/lib/layout';
import type { Moment } from '@/types/database';
import { useCardBorder } from '@/hooks/useCardBorder';

/** The photo spans the page column minus Home's 16pt padding and the card's own 12pt. */
function mediaSize(contentWidth: number) {
  const width = contentWidth - 32 - 24;
  return { width, height: Math.round(Math.min(420, width * 1.18)) };
}
const SWIPE_THRESHOLD = 48;
const QUICK_REACTIONS = ['❤️', '😂', '🥹', '🔥'] as const;

interface PartnerMomentHomeProps {
  partnerMoments: Moment[];
}

/**
 * Home's hero: your partner's latest moment — one big photo/video (swipe for
 * their others today, tap for full screen), a row of quick reactions, and a
 * one-line reply that goes straight to chat.
 */
export function PartnerMomentHome({ partnerMoments }: PartnerMomentHomeProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const cardBorder = useCardBorder();
  // Live: follows the page column (folds, tablets, rotation).
  const { width: MEDIA_W, height: MEDIA_H } = mediaSize(useContentWidth());
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const openMomentViewer = useUIStore((s) => s.openMomentViewer);
  const setShowMomentHistory = useUIStore((s) => s.setShowMomentHistory);
  const setMomentHistoryReturnToCamera = useUIStore((s) => s.setMomentHistoryReturnToCamera);
  const setChatDraft = useUIStore((s) => s.setChatDraft);
  const setChatMomentReply = useUIStore((s) => s.setChatMomentReply);

  // Clamped against the list, so a refreshed list can't point past the end.
  const [index, setIndex] = useState(0);
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [localReactions, setLocalReactions] = useState<Record<string, Record<string, string[]>>>({});

  const reactMutation = useMomentReaction();
  const sendMessageMutation = useSendMessage();

  const activeIndex = partnerMoments.length === 0 ? 0 : Math.min(index, partnerMoments.length - 1);
  const baseMoment = partnerMoments[activeIndex];
  const moment = useMemo(() => {
    if (!baseMoment) return null;
    const patch = localReactions[baseMoment.id];
    return patch ? { ...baseMoment, reactions: patch } : baseMoment;
  }, [baseMoment, localReactions]);

  const react = useCallback(
    (emoji: string) => {
      if (!user || !baseMoment) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLocalReactions((prev) => {
        const current = prev[baseMoment.id] ?? baseMoment.reactions ?? {};
        return { ...prev, [baseMoment.id]: toggleMomentReactionForUser(current, user.id, emoji) };
      });
      reactMutation.mutate({ momentId: baseMoment.id, emoji });
      setShowMore(false);
    },
    [baseMoment, user, reactMutation],
  );

  const goTo = (next: number) => {
    if (next < 0 || next >= partnerMoments.length) return;
    void Haptics.selectionAsync();
    setIndex(next);
    setShowMore(false);
  };

  // 20pt: starts before Home's 25pt tab swipe, so dragging the photo flips moments.
  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-14, 14])
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) runOnJS(goTo)(activeIndex + 1);
      else if (e.translationX > SWIPE_THRESHOLD) runOnJS(goTo)(activeIndex - 1);
    });

  if (!baseMoment || !moment) return null;

  const isMine = !!user && moment.user_id === user.id;
  const authorName = isMine ? 'You' : (moment.author?.name ?? partner?.name ?? 'Partner');
  const authorAvatar = isMine ? user?.avatar_url : (moment.author?.avatar_url ?? partner?.avatar_url);
  const partnerFirst = getFirstName(partner?.name) ?? 'your partner';
  const ago = formatDistanceToNowStrict(new Date(moment.created_at), { addSuffix: true });
  const myReaction = user ? getUserReactionEmoji(moment, user.id) : null;
  const extraReaction = !!myReaction && !(QUICK_REACTIONS as readonly string[]).includes(myReaction);
  const isVideo = moment.type === 'video';

  const openFullscreen = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openMomentViewer(partnerMoments, activeIndex);
  };

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || sendingReply) return;
    setSendingReply(true);
    try {
      await sendMessageMutation.mutateAsync({
        content: text,
        momentId: moment.id,
        mediaUrl: moment.media_url ?? undefined,
        mediaType: isVideo ? 'video' : 'image',
      });
      setReply('');
      router.navigate('/chat');
    } catch {
      setChatDraft(text);
      setChatMomentReply(momentToReplyContext(moment));
      router.navigate('/chat');
    } finally {
      setSendingReply(false);
    }
  };

  const canSend = !!reply.trim() && !sendingReply;

  return (
    <View>
      <View style={[styles.card, cardSurface(colors)]}>
        <View style={styles.head}>
          <Avatar name={authorName} imageUrl={authorAvatar} size={34} />
          <View style={styles.headText}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {isMine ? 'You' : getFirstName(authorName) ?? authorName}
            </Text>
            <Text style={[styles.ago, { color: colors.textTertiary }]}>{ago}</Text>
          </View>
          <Pressable
            onPress={() => {
              setMomentHistoryReturnToCamera(false);
              setShowMomentHistory(true);
            }}
            hitSlop={6}
            style={styles.headBtn}
            accessibilityRole="button"
            accessibilityLabel="Open our moments">
            <Icon name="albums" size={26} color={colors.text} />
          </Pressable>
        </View>

        {/* Where you are in the set: the story bars, in their own row above the photo (not on it). */}
        {partnerMoments.length > 1 ? (
          <View
            style={styles.segments}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`Moment ${activeIndex + 1} of ${partnerMoments.length}`}>
            {partnerMoments.map((m, i) => (
              <View
                key={m.id}
                style={[styles.segment, { backgroundColor: colors.text, opacity: i === activeIndex ? 1 : 0.22 }]}
              />
            ))}
          </View>
        ) : null}

        <GestureDetector gesture={swipe}>
          <Pressable onPress={openFullscreen} accessibilityRole="imagebutton" accessibilityLabel="Open moment">
            <View style={[styles.media, { width: MEDIA_W, height: MEDIA_H, backgroundColor: colors.surfaceElevated }, cardEdge(colors)]}>
              {moment.media_url ? (
                isVideo ? (
                  <MomentVideoPlayer uri={moment.media_url} width={MEDIA_W} height={MEDIA_H} autoPlay={false} controls={false} />
                ) : (
                  <Image source={mediaSource(moment.media_url)} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                )
              ) : null}
              {isVideo ? (
                <View style={styles.playPill}>
                  <Icon name="play" size={14} color="#fff" filled />
                </View>
              ) : null}
            </View>
          </Pressable>
        </GestureDetector>


        {/* Reactions and reply are off here: opening the moment (full screen) offers both, and the
            inline reply box pushed the Home layout around while typing.
        <View style={styles.reactions}>
          {QUICK_REACTIONS.map((emoji) => {
            const on = myReaction === emoji;
            return (
              <Pressable
                key={emoji}
                onPress={() => react(emoji)}
                accessibilityRole="button"
                accessibilityLabel={`React ${emoji}`}
                accessibilityState={{ selected: on }}
                style={[
                  styles.reactBtn,
                  { backgroundColor: on ? colors.accentSoft : colors.surfaceElevated, borderColor: on ? colors.accent : 'transparent' },
                ]}>
                <Text style={styles.reactEmoji}>{emoji}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setShowMore((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="More reactions"
            style={[
              styles.reactBtn,
              {
                backgroundColor: extraReaction ? colors.accentSoft : colors.surfaceElevated,
                borderColor: extraReaction ? colors.accent : 'transparent',
              },
            ]}>
            {extraReaction ? (
              <Text style={styles.reactEmoji}>{myReaction}</Text>
            ) : (
              <Icon name={showMore ? 'close' : 'plus'} size={20} color={colors.text} />
            )}
          </Pressable>
        </View>
        {showMore ? (
          <View style={styles.moreRow}>
            {LOCKET_EXTRA_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => react(emoji)}
                accessibilityLabel={`React ${emoji}`}
                style={[styles.moreBtn, { backgroundColor: myReaction === emoji ? colors.accentSoft : 'transparent' }]}>
                <Text style={styles.reactEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.replyRow}>
          <TextInput
            value={reply}
            onChangeText={setReply}
            placeholder={isMine ? 'Note to self…' : `Whisper to ${partnerFirst}…`}
            placeholderTextColor={colors.textTertiary}
            style={[styles.replyInput, { backgroundColor: colors.background, color: colors.text }, cardEdge(colors)]}
            returnKeyType="send"
            onSubmitEditing={() => void sendReply()}
            editable={!sendingReply}
          />
          <Pressable
            onPress={() => void sendReply()}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send reply"
            style={[styles.sendBtn, { backgroundColor: canSend ? colors.accent : colors.surfaceElevated }]}>
            <Icon name="send" size={18} color={canSend ? colors.onAccent : colors.textTertiary} filled />
          </Pressable>
        </View>
        */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 28, padding: 12, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, paddingTop: 2 },
  headText: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontSize: 15, fontWeight: '800' },
  ago: { fontSize: 12, fontWeight: '600' },
  headBtn: { width: 44, height: 44, marginRight: -6, alignItems: 'center', justifyContent: 'center' },
  media: { borderRadius: 22, overflow: 'hidden' },
  playPill: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segments: { flexDirection: 'row', gap: 4, paddingHorizontal: 4, marginBottom: 2 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  reactions: { flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
  reactBtn: { flex: 1, height: 46, borderRadius: 23, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  reactEmoji: { fontSize: 22 },
  moreRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginTop: -4 },
  moreBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  replyInput: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  sendBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
