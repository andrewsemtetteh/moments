import { Image } from 'expo-image';
import { mediaSource } from '@/lib/storage-cdn';
import { format } from 'date-fns';
import * as Haptics from '@/lib/haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ChatAttachmentCard } from '@/components/chat/ChatAttachmentCard';
import { ChatVideoMessage } from '@/components/chat/ChatVideoMessage';
import { MomentReplyCard } from '@/components/chat/MomentReplyCard';
import { VoiceNotePlayer } from '@/components/chat/VoiceNotePlayer';
import { Icon } from '@/components/ui/Icon';
import { colorWithAlpha } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { parseAttachment } from '@/lib/chat-attachments';
import { getMessagePreviewText } from '@/lib/message-preview';
import { isMomentReplyMessage } from '@/lib/moment-reply';
import { useAuthStore } from '@/stores';
import type { Message, UserProfile } from '@/types/database';

const SWIPE_REPLY_THRESHOLD = 52;
const SWIPE_REPLY_VELOCITY = 420;

interface ChatBubbleProps {
  message: Message;
  replyToMessage?: Message | null;
  partner?: UserProfile | null;
  onLongPress?: (message: Message) => void;
  onSwipeReply?: (message: Message) => void;
  /** Just jumped to (pinned bar, reply quote): the row flashes so the eye finds it. */
  highlighted?: boolean;
}

export function ChatBubble({
  message,
  replyToMessage,
  partner,
  onLongPress,
  onSwipeReply,
  highlighted = false,
}: ChatBubbleProps) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const isSelf = message.sender_id === user?.id;
  // Local-only until the server confirms it (sending now, or waiting in the
  // offline queue) — gets a clock instead of a "sent" tick, and no message
  // actions, since react/pin/delete need a real server id.
  const isPending = message.id.startsWith('temp-');
  const reactions = Object.entries(message.reactions ?? {}).filter(([, users]) => users.length > 0);
  const translateX = useSharedValue(0);

  const selfTextColor = colors.chatBubbleSelfText;
  const partnerTextColor = colors.text;
  const textColor = isSelf ? selfTextColor : partnerTextColor;
  const timeColor = isSelf ? `${selfTextColor}99` : colors.textTertiary;
  const isDeleted = message.deleted_for_all;
  const attachment = !isDeleted ? parseAttachment(message.content) : null;
  // Boxy cards (maps, contacts, photos) sit flush against their own borders — the default
  // bubble gap reads as touching when two are stacked back to back, so give them more room.
  const isBoxyContent = !isDeleted && (!!attachment || (!!message.media_url && message.media_type !== 'voice'));
  const replyAuthor = replyToMessage?.sender_id === user?.id ? 'You' : (partner?.name ?? 'Partner');

  const partnerBorderColor = colors.glass ? colors.borderStrong : colors.border;

  const triggerReply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSwipeReply?.(message);
  };

  // Swipe LEFT to reply — a right swipe anywhere on the screen closes the chat.
  const swipeReply = Gesture.Pan()
    .activeOffsetX(-14)
    .failOffsetX(10)
    .failOffsetY([-14, 14])
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, -84);
      }
    })
    .onEnd((event) => {
      if (onSwipeReply && (event.translationX < -SWIPE_REPLY_THRESHOLD || event.velocityX < -SWIPE_REPLY_VELOCITY)) {
        runOnJS(triggerReply)();
      }
      translateX.value = withSpring(0, { damping: 22, stiffness: 280 });
    });

  const bubbleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Fades in, holds, fades out: the WhatsApp / Telegram "here it is" flash.
  const flash = useSharedValue(0);
  useEffect(() => {
    if (!highlighted) return;
    flash.value = withSequence(
      withTiming(1, { duration: 220 }),
      withTiming(1, { duration: 700 }),
      withTiming(0, { duration: 600 }),
    );
  }, [highlighted, flash]);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  const replyHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(-translateX.value, [0, 28, 72], [0, 0.5, 1]),
    transform: [{ scale: interpolate(-translateX.value, [0, 72], [0.6, 1]) }],
  }));

  return (
    <View style={[styles.row, isSelf ? styles.rowSelf : styles.rowPartner, isBoxyContent && styles.rowBoxy]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.flash, { backgroundColor: colorWithAlpha(colors.accent, 0.2) }, flashStyle]}
      />
      <Animated.View style={[styles.replyHint, replyHintStyle]}>
        <Icon name="reply" size={20} color={colors.accent} />
      </Animated.View>

      <GestureDetector gesture={swipeReply}>
        <Animated.View style={bubbleAnimStyle}>
          <Pressable
            onLongPress={isPending ? undefined : () => onLongPress?.(message)}
            delayLongPress={250}
            style={[
              styles.bubble,
              isSelf ? styles.bubbleSelf : styles.bubblePartner,
              {
                backgroundColor: isSelf ? colors.chatBubbleSelf : colors.chatBubblePartner,
                borderColor: isSelf ? (colors.glass ? colors.borderStrong : 'transparent') : partnerBorderColor,
                borderWidth: isSelf ? (colors.glass ? StyleSheet.hairlineWidth : 0) : StyleSheet.hairlineWidth,
              },
            ]}>
            {message.is_pinned && !isDeleted && (
              <View style={styles.pinnedTag}>
                <Icon name="pin" size={11} color={isSelf ? `${selfTextColor}CC` : colors.textSecondary} filled />
                <Text style={[styles.pinnedText, { color: isSelf ? `${selfTextColor}CC` : colors.textSecondary }]}>
                  Pinned
                </Text>
              </View>
            )}

            {replyToMessage && !isDeleted && (
              <View
                style={[
                  styles.replyQuote,
                  {
                    // Your bubble is the accent colour in most themes: draw the quote in its text colour there.
                    borderLeftColor: isSelf ? selfTextColor : colors.accent,
                    backgroundColor: isSelf ? `${selfTextColor}1F` : colors.accentSoft,
                  },
                ]}>
                <Text style={[styles.replyAuthor, { color: isSelf ? selfTextColor : colors.accent }]} numberOfLines={1}>
                  {replyAuthor}
                </Text>
                <Text
                  style={[styles.replyText, { color: isSelf ? `${selfTextColor}CC` : colors.textSecondary }]}
                  numberOfLines={2}>
                  {getMessagePreviewText(replyToMessage)}
                </Text>
              </View>
            )}

            {isDeleted ? (
              <Text style={[styles.deletedText, { color: isSelf ? `${selfTextColor}99` : colors.textSecondary }]}>
                This message was deleted
              </Text>
            ) : (
              <>
                {isMomentReplyMessage(message) && <MomentReplyCard message={message} isSelf={isSelf} />}

                {message.media_url && message.media_type === 'image' && !message.moment_id && (
                  <Image source={mediaSource(message.media_url)} style={styles.media} contentFit="cover" />
                )}

                {message.media_url && message.media_type === 'video' && !message.moment_id && (
                  <ChatVideoMessage uri={message.media_url} isSelf={isSelf} />
                )}

                {message.media_url && message.media_type === 'voice' && (
                  <VoiceNotePlayer uri={message.media_url} isSelf={isSelf} />
                )}

                {attachment && <ChatAttachmentCard attachment={attachment} isSelf={isSelf} />}

                {message.content &&
                  message.media_type !== 'voice' &&
                  message.media_type !== 'video' &&
                  message.media_type !== 'image' &&
                  !attachment && <Text style={[styles.text, { color: textColor }]}>{message.content}</Text>}
              </>
            )}

            <View style={styles.meta}>
              <Text style={[styles.time, { color: timeColor }]}>
                {message.edited_at && !message.deleted_for_all ? 'Edited · ' : ''}
                {format(new Date(message.created_at), 'h:mm a')}
              </Text>
              {isSelf && isPending ? (
                <Icon name="time" size={13} color={`${selfTextColor}80`} />
              ) : isSelf ? (
                <Icon
                  name={message.read_at ? 'checkDone' : 'check'}
                  size={14}
                  color={message.read_at ? colors.chatReadReceipt : `${selfTextColor}80`}
                  filled={!!message.read_at}
                />
              ) : null}
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>

      {reactions.length > 0 && (
        <View
          style={[
            styles.reactions,
            isSelf ? styles.reactionsSelf : styles.reactionsPartner,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}>
          {reactions.map(([emoji, users]) => (
            <Text key={emoji} style={styles.reactionText}>
              {emoji}
              {users.length > 1 ? ` ${users.length}` : ''}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 4, paddingHorizontal: 6, position: 'relative' },
  flash: { position: 'absolute', top: -2, bottom: -2, left: -16, right: -16 },
  rowBoxy: { marginBottom: 10 },
  rowSelf: { alignItems: 'flex-end' },
  rowPartner: { alignItems: 'flex-start' },
  replyHint: {
    position: 'absolute',
    top: '50%',
    marginTop: -12,
    right: 18,
    zIndex: 0,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleSelf: { borderRadius: 12, borderBottomRightRadius: 2 },
  bubblePartner: { borderRadius: 12, borderBottomLeftRadius: 2 },
  pinnedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  pinnedText: { fontSize: 10, fontWeight: '700' },
  replyQuote: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
  },
  replyAuthor: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  replyText: { fontSize: 12, lineHeight: 16 },
  deletedText: { fontSize: 15, fontStyle: 'italic' },
  media: { width: 220, height: 220, borderRadius: 10, marginBottom: 6 },
  text: { fontSize: 16, lineHeight: 21 },
  meta: { flexDirection: 'row', gap: 4, marginTop: 2, alignItems: 'center', alignSelf: 'flex-end' },
  time: { fontSize: 11 },
  reactions: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: -4,
    marginHorizontal: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '82%',
  },
  reactionsSelf: { alignSelf: 'flex-end' },
  reactionsPartner: { alignSelf: 'flex-start' },
  reactionText: { fontSize: 13 },
});
