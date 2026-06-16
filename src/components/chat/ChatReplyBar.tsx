import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { getMessagePreviewText } from '@/lib/message-preview';
import type { Message, UserProfile } from '@/types/database';

interface Props {
  message: Message;
  partner: UserProfile | null;
  userId: string;
  onClose: () => void;
}

export function ChatReplyBar({ message, partner, userId, onClose }: Props) {
  const { colors } = useTheme();
  const isSelf = message.sender_id === userId;
  const author = isSelf ? 'You' : partner?.name ?? 'Partner';

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <View style={[styles.accent, { backgroundColor: colors.accent }]} />
      <View style={styles.meta}>
        <Text style={[styles.title, { color: colors.accent }]} numberOfLines={1}>
          Replying to {author}
        </Text>
        <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={1}>
          {getMessagePreviewText(message)}
        </Text>
      </View>
      <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Cancel reply">
        <Icon name="close" size={20} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  accent: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  meta: { flex: 1, gap: 2 },
  title: { fontSize: 13, fontWeight: '700' },
  preview: { fontSize: 12, fontWeight: '500' },
});
