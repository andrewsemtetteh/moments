import { isToday } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { LocketReactionCluster } from '@/components/moments/LocketReactionCluster';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { formatMomentDateLabel, getMomentReactionHistory, getUserReactionEmoji } from '@/lib/moment-display';
import { momentChrome, viewerChrome } from '@/lib/moment-theme';
import type { Moment } from '@/types/database';

const CLUSTER_W = Math.min(Dimensions.get('window').width - 48, 340);

interface MomentViewerDockProps {
  moment: Moment;
  isMine: boolean;
  authorName: string;
  authorAvatar?: string | null;
  partnerName: string;
  timeAgo: string;
  userId: string;
  partnerId?: string | null;
  reply: string;
  onReplyChange: (text: string) => void;
  onSendReply: () => void;
  onReact: (emoji: string) => void;
  sending?: boolean;
  bottomInset: number;
  /** Viewer layout: no sheet behind it and no author row (that's in the header). */
  floating?: boolean;
  /** The viewer's always-dark palette. */
  dark?: boolean;
}

export function MomentViewerDock({
  moment,
  isMine,
  authorName,
  authorAvatar,
  partnerName,
  timeAgo,
  userId,
  partnerId,
  reply,
  onReplyChange,
  onSendReply,
  onReact,
  sending,
  bottomInset,
  floating = false,
  dark = false,
}: MomentViewerDockProps) {
  const { colors } = useTheme();
  const chrome = dark ? viewerChrome(colors) : momentChrome(colors);
  const createdAt = new Date(moment.created_at);
  // "3 hours ago" is only useful the same day — past that, a plain date/weekday
  // reads better than stacking a date next to a redundant relative time.
  const dateLine = isToday(createdAt) ? timeAgo : formatMomentDateLabel(createdAt);
  const reactionHistory = getMomentReactionHistory(moment, userId, partnerId, partnerName);
  const userReaction = getUserReactionEmoji(moment, userId);
  const [pickerOpen, setPickerOpen] = useState(() => !userReaction);

  useEffect(() => {
    // New moment (or viewer) — default open only when there's nothing reacted yet.
    setPickerOpen(!getUserReactionEmoji(moment, userId));
    // keyed on moment.id on purpose: the full `moment` object changes reference whenever anyone
    // reacts, which would otherwise reopen the picker on every reaction instead of only on
    // moment navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment.id, userId]);

  // Not OR'd with `!userReaction` anymore — removing a reaction (tapping the same
  // emoji again) used to force this back open right after closing it, since that
  // toggle nulls userReaction. Closing should stay closed either way now.
  const showPicker = pickerOpen;

  const handleReact = (emoji: string) => {
    onReact(emoji);
    setPickerOpen(false);
  };

  const inputRef = useRef<TextInput>(null);
  const [replyFocused, setReplyFocused] = useState(false);
  const dragY = useSharedValue(0);

  const dismissReplyKeyboard = () => {
    inputRef.current?.blur();
    Keyboard.dismiss();
  };

  // Only active while replying — drag the drawer down to dismiss the keyboard,
  // same gesture language as the rest of the app's drag-to-dismiss sheets.
  const dragHandle = Gesture.Pan()
    .enabled(replyFocused)
    .activeOffsetY([-6, 6])
    .failOffsetX([-14, 14])
    .onUpdate((event) => {
      dragY.value = event.translationY > 0 ? event.translationY : 0;
    })
    .onEnd((event) => {
      const shouldDismiss = event.translationY > 50 || event.velocityY > 600;
      if (shouldDismiss) runOnJS(dismissReplyKeyboard)();
      dragY.value = withSpring(0, { damping: 26, stiffness: 300 });
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  const body = (
    <View style={[styles.inner, { paddingBottom: bottomInset + 10 }]}>
      <GestureDetector gesture={dragHandle}>
        <View style={styles.handleTouchTarget} hitSlop={{ top: 8, bottom: 8, left: 24, right: 24 }}>
          <View style={[styles.handle, { backgroundColor: replyFocused ? chrome.accent : chrome.border }]} />
        </View>
      </GestureDetector>

      {floating ? null : (
        <View style={styles.authorRow}>
          <View style={[styles.avatarRing, { borderColor: isMine ? '#e85d75' : '#5b8def' }]}>
            <Avatar name={authorName} imageUrl={authorAvatar} size={36} />
          </View>
          <View style={styles.authorMeta}>
            <Text style={[styles.authorName, { color: chrome.text }]}>{isMine ? 'You' : authorName}</Text>
            <Text style={[styles.dateLine, { color: chrome.textSecondary }]}>{dateLine}</Text>
          </View>
        </View>
      )}

      <View style={styles.historyBlock}>
        {/* <Text style={[styles.historyTitle, { color: chrome.textTertiary }]}>Reaction history</Text> */}
        {reactionHistory.length ===
        0 ? // <Text style={[styles.historyEmpty, { color: chrome.textTertiary }]}>No reactions yet. Be the first!</Text>
        null : (
          <View style={styles.historyRow}>
            {reactionHistory.map((item, i) => {
              const chip = (
                <>
                  <Text style={styles.historyEmoji}>{item.emoji}</Text>
                  <Text
                    style={[
                      styles.historyWho,
                      { color: chrome.textSecondary },
                      item.isYou && { color: colors.accent },
                    ]}>
                    {item.label}
                  </Text>
                </>
              );

              if (item.isYou) {
                return (
                  <Pressable
                    key={`${item.emoji}-${item.label}-${i}`}
                    onPress={() => setPickerOpen(true)}
                    style={[styles.historyChip, { backgroundColor: chrome.accentSoft, borderColor: colors.accent }]}>
                    {chip}
                  </Pressable>
                );
              }

              return (
                <View
                  key={`${item.emoji}-${item.label}-${i}`}
                  style={[styles.historyChip, { backgroundColor: chrome.surfaceSoft, borderColor: chrome.border }]}>
                  {chip}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {showPicker && (
        <LocketReactionCluster moment={moment} width={CLUSTER_W} onReact={handleReact} variant="preview" />
      )}

      <View style={styles.replyRow}>
        <TextInput
          ref={inputRef}
          value={reply}
          onChangeText={onReplyChange}
          placeholder={isMine ? 'Note to self…' : `Whisper to ${partnerName.split(' ')[0]}…`}
          placeholderTextColor={chrome.textTertiary}
          style={[
            styles.replyInput,
            { backgroundColor: chrome.surfaceSoft, color: chrome.text, borderColor: chrome.border },
          ]}
          returnKeyType="send"
          onSubmitEditing={onSendReply}
          onFocus={() => setReplyFocused(true)}
          onBlur={() => setReplyFocused(false)}
          editable={!sending}
        />
        <Pressable
          onPress={onSendReply}
          disabled={!reply.trim() || sending}
          style={[styles.sendBtn, { backgroundColor: reply.trim() && !sending ? colors.accent : chrome.surfaceSoft }]}>
          <Icon name="send" size={18} color={reply.trim() && !sending ? colors.onAccent : chrome.textTertiary} />
        </Pressable>
      </View>

      <Text style={[styles.privacy, { color: chrome.textTertiary }]}>Just between you two</Text>
    </View>
  );

  if (floating) {
    return <Animated.View style={[styles.floating, dragStyle]}>{body}</Animated.View>;
  }
  return (
    <Animated.View style={[styles.dockShadowWrap, dragStyle]}>
      <View style={[styles.dock, { backgroundColor: chrome.elevated, borderColor: chrome.border }]}>{body}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dockShadowWrap: {
    zIndex: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  dock: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inner: { paddingHorizontal: 18, paddingTop: 6, gap: 12 },
  floating: { zIndex: 6 },
  handleTouchTarget: { alignSelf: 'center', paddingVertical: 8 },
  handle: { width: 36, height: 4, borderRadius: 2 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarRing: { borderRadius: 999, borderWidth: 2, padding: 1.5 },
  authorMeta: { flex: 1, gap: 3 },
  authorName: { fontSize: 16, fontWeight: '800' },
  dateLine: { fontSize: 12, fontWeight: '600' },
  historyBlock: { gap: 8 },
  historyTitle: {
    fontSize: 11,
    fontWeight: '800',
  },
  historyEmpty: { fontSize: 13, fontWeight: '600' },
  historyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  historyEmoji: { fontSize: 16 },
  historyWho: { fontSize: 12, fontWeight: '700' },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  replyInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
    borderWidth: 1,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacy: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
