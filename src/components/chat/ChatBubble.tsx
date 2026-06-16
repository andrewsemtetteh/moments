import { Image } from 'expo-image';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { MomentReplyCard } from '@/components/chat/MomentReplyCard';
import { VoiceNotePlayer } from '@/components/chat/VoiceNotePlayer';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
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
  isUnread?: boolean;
  onLongPress?: (message: Message) => void;
  onSwipeReply?: (message: Message) => void;
}

export function ChatBubble({
  message,
  replyToMessage,
  partner,
  isUnread = false,
  onLongPress,
  onSwipeReply,
}: ChatBubbleProps) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const isSelf = message.sender_id === user?.id;
  const reactions = Object.entries(message.reactions ?? {}).filter(([, users]) => users.length > 0);
  const translateX = useSharedValue(0);

  const selfTextColor = colors.chatBubbleSelfText;
  const partnerTextColor = colors.text;
  const textColor = isSelf ? selfTextColor : partnerTextColor;
  const timeColor = isSelf ? `${selfTextColor}99` : colors.textTertiary;
  const isDeleted = message.deleted_for_all;
  const replyAuthor =
    replyToMessage?.sender_id === user?.id ? 'You' : partner?.name ?? 'Partner';

  const partnerBorderColor = isUnread ? colors.accent : colors.glass ? colors.borderStrong : colors.border;
  const partnerBorderWidth = isUnread ? 1.5 : StyleSheet.hairlineWidth;

  const triggerReply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSwipeReply?.(message);
  };

  const swipeReply = Gesture.Pan()
    .activeOffsetX(14)
    .failOffsetX(-10)
    .failOffsetY([-14, 14])
    .onUpdate((event) => {
      if (event.translationX > 0) {
        translateX.value = Math.min(event.translationX, 84);
      }
    })
    .onEnd((event) => {
      if (
        onSwipeReply &&
        (event.translationX > SWIPE_REPLY_THRESHOLD || event.velocityX > SWIPE_REPLY_VELOCITY)
      ) {
        runOnJS(triggerReply)();
      }
      translateX.value = withSpring(0, { damping: 22, stiffness: 280 });
    });

  const bubbleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const replyHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 28, 72], [0, 0.5, 1]),
    transform: [{ scale: interpolate(translateX.value, [0, 72], [0.6, 1]) }],
  }));

  return (
    <View style={[styles.row, isSelf && styles.rowSelf]}>
      {!isSelf && isUnread && (
        <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />
      )}

      <Animated.View
        style={[styles.replyHint, isSelf ? styles.replyHintSelf : styles.replyHintPartner, replyHintStyle]}>
        <Icon name="reply" size={20} color={colors.accent} />
      </Animated.View>

      <GestureDetector gesture={swipeReply}>
        <Animated.View style={bubbleAnimStyle}>
          <Pressable
            onLongPress={() => onLongPress?.(message)}
            delayLongPress={250}
            style={[
              styles.bubble,
              isSelf ? styles.bubbleSelf : styles.bubblePartner,
              {
                backgroundColor: isSelf ? colors.chatBubbleSelf : colors.chatBubblePartner,
                borderColor: isSelf ? (colors.glass ? colors.borderStrong : 'transparent') : partnerBorderColor,
                borderWidth: isSelf ? (colors.glass ? StyleSheet.hairlineWidth : 0) : partnerBorderWidth,
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
                    borderLeftColor: colors.accent,
                    backgroundColor: isSelf ? 'rgba(255,255,255,0.12)' : colors.accentSoft,
                  },
                ]}>
                <Text style={[styles.replyAuthor, { color: colors.accent }]} numberOfLines={1}>
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
                  <Image source={{ uri: message.media_url }} style={styles.media} contentFit="cover" />
                )}

                {message.media_url && message.media_type === 'voice' && (
                  <VoiceNotePlayer uri={message.media_url} isSelf={isSelf} />
                )}

                {message.content && message.media_type !== 'voice' && (
                  <Text
                    style={[
                      styles.text,
                      { color: textColor },
                      !isSelf && isUnread && styles.unreadText,
                    ]}>
                    {message.content}
                  </Text>
                )}
              </>
            )}

            <View style={styles.meta}>
              <Text style={[styles.time, { color: timeColor }]}>
                {format(new Date(message.created_at), 'h:mm a')}
              </Text>
              {isSelf && (
                <Icon
                  name={message.read_at ? 'checkDone' : 'check'}
                  size={14}
                  color={message.read_at ? colors.chatReadReceipt : `${selfTextColor}80`}
                  filled={!!message.read_at}
                />
              )}
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>

      {reactions.length > 0 && (
        <View
          style={[
            styles.reactions,
            isSelf && { alignSelf: 'flex-end' },
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
  rowSelf: { alignItems: 'flex-end' },
  unreadDot: {
    position: 'absolute',
    left: 0,
    bottom: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 2,
  },
  replyHint: {
    position: 'absolute',
    top: '50%',
    marginTop: -12,
    zIndex: 0,
  },
  replyHintPartner: { left: 18 },
  replyHintSelf: { right: 18 },
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
  unreadText: { fontWeight: '600' },
  meta: { flexDirection: 'row', gap: 4, marginTop: 2, alignItems: 'center', alignSelf: 'flex-end' },
  time: { fontSize: 11 },
  reactions: {
    flexDirection: 'row',
    gap: 4,
    marginTop: -4,
    marginHorizontal: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reactionText: { fontSize: 13 },
});
