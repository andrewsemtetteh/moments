import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { format } from 'date-fns';

import { Icon } from '@/components/ui/Icon';
import { VoiceNotePlayer } from '@/components/chat/VoiceNotePlayer';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores';
import type { Message } from '@/types/database';

interface ChatBubbleProps {
  message: Message;
  onLongPress?: (message: Message) => void;
}

export function ChatBubble({ message, onLongPress }: ChatBubbleProps) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const isSelf = message.sender_id === user?.id;
  const reactions = Object.entries(message.reactions ?? {}).filter(([, users]) => users.length > 0);

  const selfTextColor = colors.chatBubbleSelfText;
  const partnerTextColor = colors.text;
  const textColor = isSelf ? selfTextColor : partnerTextColor;
  const timeColor = isSelf ? `${selfTextColor}99` : colors.textTertiary;

  return (
    <View style={[styles.row, isSelf && styles.rowSelf]}>
      <Pressable
        onLongPress={() => onLongPress?.(message)}
        delayLongPress={250}
        style={[
          styles.bubble,
          isSelf ? styles.bubbleSelf : styles.bubblePartner,
          {
            backgroundColor: isSelf ? colors.chatBubbleSelf : colors.chatBubblePartner,
            borderColor: colors.glass ? colors.borderStrong : isSelf ? 'transparent' : colors.border,
            ...(colors.glass || !isSelf ? { borderWidth: StyleSheet.hairlineWidth } : {}),
          },
        ]}>
        {message.is_pinned && (
          <View style={styles.pinnedTag}>
            <Icon name="pin" size={11} color={isSelf ? `${selfTextColor}CC` : colors.textSecondary} filled />
            <Text style={[styles.pinnedText, { color: isSelf ? `${selfTextColor}CC` : colors.textSecondary }]}>
              Pinned
            </Text>
          </View>
        )}

        {message.media_url && message.media_type === 'image' && (
          <Image source={{ uri: message.media_url }} style={styles.media} contentFit="cover" />
        )}

        {message.media_url && message.media_type === 'voice' && (
          <VoiceNotePlayer uri={message.media_url} isSelf={isSelf} />
        )}

        {message.content && message.media_type !== 'voice' && (
          <Text style={[styles.text, { color: textColor }]}>{message.content}</Text>
        )}

        <View style={styles.meta}>
          <Text style={[styles.time, { color: timeColor }]}>{format(new Date(message.created_at), 'h:mm a')}</Text>
          {isSelf && (
            <Icon
              name="checkDone"
              size={14}
              color={message.read_at ? colors.chatReadReceipt : `${selfTextColor}80`}
              filled={!!message.read_at}
            />
          )}
        </View>
      </Pressable>

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
  row: { marginBottom: 4, paddingHorizontal: 6 },
  rowSelf: { alignItems: 'flex-end' },
  bubble: { maxWidth: '82%', paddingHorizontal: 10, paddingTop: 7, paddingBottom: 6, borderWidth: StyleSheet.hairlineWidth },
  bubbleSelf: { borderRadius: 12, borderBottomRightRadius: 2 },
  bubblePartner: { borderRadius: 12, borderBottomLeftRadius: 2 },
  pinnedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  pinnedText: { fontSize: 10, fontWeight: '700' },
  media: { width: 220, height: 220, borderRadius: 10, marginBottom: 6 },
  text: { fontSize: 16, lineHeight: 21 },
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
