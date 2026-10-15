import { useQueryClient } from '@tanstack/react-query';
import { format, isThisYear, isToday, isYesterday } from 'date-fns';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector, FlatList as PagerList } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MomentVideoPlayer } from '@/components/moments/MomentVideoPlayer';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useSendMessage } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { useVideoThumbnail } from '@/hooks/useVideoThumbnail';
import * as Haptics from '@/lib/haptics';
import { momentToReplyContext } from '@/lib/moment-reply';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import type { Moment } from '@/types/database';
import { MOMENTS_BACK, useMomentsBack } from '@/lib/moments-back';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const THUMB = 44;
const THUMB_GAP = 6;

function whenLabel(date: Date) {
  const time = format(date, 'h:mm a');
  if (isToday(date)) return `Today · ${time}`;
  if (isYesterday(date)) return `Yesterday · ${time}`;
  return format(date, isThisYear(date) ? "EEE d MMM '·' h:mm a" : "d MMM yyyy '·' h:mm a");
}

/**
 * A moment opened from Our moments (or a chat reply): the way Photos and
 * Instagram show your own pictures. Full screen on black; swipe sideways to
 * browse, or jump with the filmstrip; tap to hide the controls; swipe down to
 * put it away (the photo shrinks and follows your finger).
 */
export function MomentFocusViewer() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const viewer = useUIStore((s) => s.momentViewer);
  const closeMomentViewer = useUIStore((s) => s.closeMomentViewer);
  const setChatDraft = useUIStore((s) => s.setChatDraft);
  const setChatMomentReply = useUIStore((s) => s.setChatMomentReply);
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const relationship = useRelationshipStore((s) => s.relationship);
  const queryClient = useQueryClient();
  const sendMessageMutation = useSendMessage();

  const moments = useMemo(() => viewer?.moments ?? [], [viewer]);
  const [index, setIndex] = useState(() => viewer?.startIndex ?? 0);
  const [chromeShown, setChromeShown] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Moment>>(null);
  const stripRef = useRef<FlatList<Moment>>(null);

  const base = moments[Math.min(index, moments.length - 1)];
  const moment = base;
  const isMine = !!user && moment?.user_id === user.id;
  const authorName = isMine ? 'You' : (moment?.author?.name ?? partner?.name ?? 'Partner');
  const authorAvatar = isMine ? user?.avatar_url : (moment?.author?.avatar_url ?? partner?.avatar_url);
  const partnerFirst = (partner?.name ?? 'them').split(' ')[0];

  const dismiss = useCallback(() => closeMomentViewer(), [closeMomentViewer]);

  useMomentsBack(MOMENTS_BACK.viewer, !!viewer, dismiss);

  // Partner's moments count as seen once opened.
  useEffect(() => {
    if (!moment || !user || isMine) return;
    void api
      .markMomentViewed(moment.id, user.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ['moments', relationship?.id] }))
      .catch(() => undefined);
    // Only when the moment on screen changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment?.id, user?.id, isMine]);

  // Keep the filmstrip's current thumbnail in view.
  useEffect(() => {
    if (moments.length > 1) stripRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
  }, [index, moments.length]);

  const onPageEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (next !== index) {
      setIndex(next);
      setReply('');
      void Haptics.selectionAsync();
    }
  };

  const jumpTo = (i: number) => {
    void Haptics.selectionAsync();
    setIndex(i);
    setReply('');
    listRef.current?.scrollToIndex({ index: i, animated: false });
  };

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || !moment) return;
    setSending(true);
    try {
      await sendMessageMutation.mutateAsync({
        content: text,
        momentId: moment.id,
        mediaUrl: moment.media_url ?? undefined,
        mediaType: moment.type === 'video' ? 'video' : 'image',
      });
    } catch {
      // Didn't go: carry it to Chat as a draft instead of losing it.
      setChatDraft(text);
      setChatMomentReply(momentToReplyContext(moment));
    } finally {
      setSending(false);
      setReply('');
      Keyboard.dismiss();
      dismiss();
      router.navigate('/chat');
    }
  };

  // Swipe down to put it away: the photo shrinks and follows your finger,
  // the black fades so History shows through; let go early and it springs back.
  const dragY = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dismissPan = Gesture.Pan()
    .activeOffsetY(14)
    .failOffsetY(-14)
    .failOffsetX([-16, 16])
    .onUpdate((e) => {
      dragY.set(Math.max(0, e.translationY));
      dragX.set(e.translationX * 0.6);
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 800) {
        dragY.set(
          withTiming(SCREEN_H * 0.6, { duration: 200, easing: Easing.out(Easing.quad) }, (done) => {
            if (done) runOnJS(dismiss)();
          }),
        );
        return;
      }
      dragY.set(withSpring(0, { damping: 28, stiffness: 300 }));
      dragX.set(withSpring(0, { damping: 28, stiffness: 300 }));
    });
  const stageStyle = useAnimatedStyle(() => {
    const scale = interpolate(dragY.value, [0, SCREEN_H * 0.5], [1, 0.7], 'clamp');
    return { transform: [{ translateX: dragX.value }, { translateY: dragY.value }, { scale }] };
  });
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragY.value, [0, SCREEN_H * 0.4], [1, 0], 'clamp'),
  }));
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragY.value, [0, 80], [1, 0], 'clamp'),
  }));

  if (!viewer || !moment) return null;

  const createdAt = new Date(moment.created_at);
  const counter = moments.length > 1 ? `${index + 1} of ${moments.length}` : null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <StatusBar style="light" hidden={!chromeShown} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.black, backdropStyle]} />

      <GestureDetector gesture={dismissPan}>
        <Animated.View style={[StyleSheet.absoluteFill, stageStyle]}>
          {/* Gesture-handler aware: paging sideways and swiping down never both fire. */}
          <PagerList
            // Same FlatList underneath; gesture-handler's typings just don't say so.
            ref={listRef as never}
            data={moments}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(m) => m.id}
            initialScrollIndex={viewer.startIndex}
            getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
            onMomentumScrollEnd={onPageEnd}
            onScrollToIndexFailed={({ index: i }) =>
              setTimeout(() => listRef.current?.scrollToIndex({ index: i, animated: false }), 50)
            }
            windowSize={3}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            renderItem={({ item, index: i }) => (
              <Pressable style={styles.page} onPress={() => setChromeShown((v) => !v)}>
                <FocusMedia moment={item} active={i === index} />
              </Pressable>
            )}
          />
        </Animated.View>
      </GestureDetector>

      {chromeShown ? (
        <KeyboardAvoidingView
          style={StyleSheet.absoluteFill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none">
          <Animated.View entering={FadeIn.duration(160)} style={[styles.fill, chromeStyle]} pointerEvents="box-none">
            {/* Top: close, who and when, and where you are in the set. */}
            <LinearGradient
              colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0)']}
              style={[styles.top, { paddingTop: insets.top + 6 }]}
              pointerEvents="box-none">
              <Pressable
                onPress={dismiss}
                hitSlop={8}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close">
                <Icon name="close" size={28} color="#fff" />
              </Pressable>
              <View style={styles.who}>
                <Avatar name={authorName} imageUrl={authorAvatar} size={36} />
                <View style={styles.whoText}>
                  <Text style={styles.whoName} numberOfLines={1}>
                    {authorName}
                  </Text>
                  <Text style={styles.whoTime} numberOfLines={1}>
                    {whenLabel(createdAt)}
                  </Text>
                </View>
              </View>
              {counter ? (
                <View style={styles.counter}>
                  <Text style={styles.counterText}>{counter}</Text>
                </View>
              ) : null}
            </LinearGradient>

            <View style={styles.flex} pointerEvents="none" />

            {/* Bottom: caption, filmstrip, reply. */}
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']}
              style={[styles.bottom, { paddingBottom: insets.bottom + 10 }]}
              pointerEvents="box-none">
              {moment.content?.trim() ? (
                <Text style={styles.caption} numberOfLines={3}>
                  {moment.content.trim()}
                </Text>
              ) : null}

              {moments.length > 1 ? (
                <FlatList
                  ref={stripRef}
                  data={moments}
                  horizontal
                  keyExtractor={(m) => `strip-${m.id}`}
                  showsHorizontalScrollIndicator={false}
                  getItemLayout={(_, i) => ({ length: THUMB + THUMB_GAP, offset: (THUMB + THUMB_GAP) * i, index: i })}
                  initialScrollIndex={Math.max(0, viewer.startIndex - 2)}
                  contentContainerStyle={styles.strip}
                  onScrollToIndexFailed={() => undefined}
                  renderItem={({ item, index: i }) => (
                    <StripThumb moment={item} active={i === index} onPress={() => jumpTo(i)} />
                  )}
                />
              ) : null}

              {/* Reply to any moment, yours or theirs: it goes to Chat with the moment attached. */}
              <View style={styles.replyRow}>
                <TextInput
                  value={reply}
                  onChangeText={setReply}
                  placeholder={isMine ? 'Say something about this…' : `Reply to ${partnerFirst}…`}
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  style={styles.replyInput}
                  returnKeyType="send"
                  onSubmitEditing={() => void sendReply()}
                  editable={!sending}
                />
                <Pressable
                  onPress={() => void sendReply()}
                  disabled={!reply.trim() || sending}
                  accessibilityRole="button"
                  accessibilityLabel="Send"
                  style={[
                    styles.sendBtn,
                    { backgroundColor: reply.trim() ? colors.accent : 'rgba(255,255,255,0.14)' },
                  ]}>
                  {sending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Icon name="send" size={18} color={reply.trim() ? colors.onAccent : 'rgba(255,255,255,0.6)'} />
                  )}
                </Pressable>
              </View>
            </LinearGradient>
          </Animated.View>
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}

/** One page: the photo at its full shape, or the video (playing only while it's the one on screen). */
function FocusMedia({ moment, active }: { moment: Moment; active: boolean }) {
  const isVideo = moment.type === 'video' && !!moment.media_url;
  const thumb = useVideoThumbnail(isVideo && !active ? moment.media_url : null);
  if (isVideo && moment.media_url) {
    return active ? (
      <MomentVideoPlayer uri={moment.media_url} fill autoPlay loop contentFit="contain" style={styles.media} />
    ) : thumb ? (
      <Image source={thumb} style={styles.media} contentFit="contain" />
    ) : null;
  }
  if (moment.media_url) {
    return <Image source={{ uri: moment.media_url }} style={styles.media} contentFit="contain" transition={150} />;
  }
  return (
    <View style={[styles.media, styles.center]}>
      <Icon name="heart" size={48} color="rgba(255,255,255,0.4)" filled />
    </View>
  );
}

function StripThumb({ moment, active, onPress }: { moment: Moment; active: boolean; onPress: () => void }) {
  const isVideo = moment.type === 'video';
  const thumb = useVideoThumbnail(isVideo ? moment.media_url : null, 160);
  const source = isVideo ? thumb : moment.media_url ? { uri: moment.media_url } : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityState={{ selected: active }}
      style={[styles.thumb, active ? styles.thumbActive : styles.thumbIdle]}>
      {source ? <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  black: { backgroundColor: '#000' },
  page: { width: SCREEN_W, height: SCREEN_H, alignItems: 'center', justifyContent: 'center' },
  media: { width: SCREEN_W, height: SCREEN_H },
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 28 },
  closeBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  counter: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  counterText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  whoText: { flex: 1, minWidth: 0 },
  whoName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  whoTime: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '600', marginTop: 1 },
  bottom: { paddingTop: 40, paddingHorizontal: 16, gap: 14 },
  caption: { color: '#fff', fontSize: 16, fontWeight: '600', lineHeight: 22, paddingHorizontal: 4 },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  replyInput: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 18,
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  sendBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  strip: { gap: THUMB_GAP, paddingVertical: 2 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  thumbActive: { borderWidth: 2, borderColor: '#fff', transform: [{ scale: 1.08 }] },
  thumbIdle: { opacity: 0.55 },
});
