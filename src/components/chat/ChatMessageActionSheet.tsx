import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChatEmojiPicker } from '@/components/chat/ChatEmojiPicker';
import { Icon } from '@/components/ui/Icon';
import { REACTION_EMOJI } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores';
import type { Message } from '@/types/database';

interface Props {
  message: Message | null;
  onClose: () => void;
  onReply: (message: Message) => void;
  onReact: (messageId: string, emoji: string) => void;
  onPin: (messageId: string, isPinned: boolean) => void;
  onDeleteForMe: (messageId: string) => void;
  onDeleteForAll: (messageId: string) => void;
}

export function ChatMessageActionSheet({
  message,
  onClose,
  onReply,
  onReact,
  onPin,
  onDeleteForMe,
  onDeleteForAll,
}: Props) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [showMoreEmojis, setShowMoreEmojis] = useState(false);

  if (!message) return null;

  const isTemp = message.id.startsWith('temp-');
  const isSelf = message.sender_id === user?.id;
  const canCopy = !message.deleted_for_all && !!message.content?.trim();
  const copyText = message.content?.trim() ?? '';

  const handleClose = () => {
    setShowMoreEmojis(false);
    onClose();
  };

  const handleReact = (emoji: string) => {
    if (!isTemp) onReact(message.id, emoji);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleClose();
  };

  const handleCopy = async () => {
    if (!copyText) return;
    await Clipboard.setStringAsync(copyText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleClose();
  };

  const handleDelete = () => {
    handleClose();
    Alert.alert('Delete message?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete for me',
        onPress: () => {
          if (!isTemp) onDeleteForMe(message.id);
        },
      },
      ...(isSelf
        ? [
            {
              text: 'Delete for everyone',
              style: 'destructive' as const,
              onPress: () => {
                if (!isTemp) onDeleteForAll(message.id);
              },
            },
          ]
        : []),
    ]);
  };

  return (
    <>
      <Modal visible={!showMoreEmojis} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable style={styles.overlay} onPress={handleClose}>
          <View
            style={[styles.sheet, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            onStartShouldSetResponder={() => true}>
            <View style={styles.reactionPicker}>
              {REACTION_EMOJI.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => handleReact(emoji)}
                  style={[styles.reactionBtn, { backgroundColor: colors.surface }]}>
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setShowMoreEmojis(true)}
                style={[styles.reactionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                accessibilityLabel="More reactions">
                <Icon name="plus" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Pressable
              style={[styles.action, { borderTopColor: colors.border }]}
              onPress={() => {
                onReply(message);
                handleClose();
              }}>
              <Icon name="reply" size={20} color={colors.text} />
              <Text style={[styles.actionText, { color: colors.text }]}>Reply</Text>
            </Pressable>

            {canCopy && (
              <Pressable style={[styles.action, { borderTopColor: colors.border }]} onPress={handleCopy}>
                <Icon name="cards" size={20} color={colors.text} />
                <Text style={[styles.actionText, { color: colors.text }]}>Copy</Text>
              </Pressable>
            )}

            {!isTemp && (
              <Pressable
                style={[styles.action, { borderTopColor: colors.border }]}
                onPress={() => {
                  onPin(message.id, !message.is_pinned);
                  handleClose();
                }}>
                <Icon name="pin" size={20} color={colors.text} filled={message.is_pinned} />
                <Text style={[styles.actionText, { color: colors.text }]}>
                  {message.is_pinned ? 'Unpin' : 'Pin message'}
                </Text>
              </Pressable>
            )}

            {!isTemp && (
              <Pressable style={[styles.action, { borderTopColor: colors.border }]} onPress={handleDelete}>
                <Icon name="trash" size={20} color={colors.error} />
                <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
              </Pressable>
            )}

            <Pressable style={[styles.action, { borderTopColor: colors.border }]} onPress={handleClose}>
              <Icon name="close" size={20} color={colors.textSecondary} />
              <Text style={[styles.actionText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showMoreEmojis} transparent animationType="slide" onRequestClose={() => setShowMoreEmojis(false)}>
        <Pressable style={styles.emojiOverlay} onPress={() => setShowMoreEmojis(false)}>
          <View style={styles.emojiSheet} onStartShouldSetResponder={() => true}>
            <ChatEmojiPicker
              onSelect={(emoji) => {
                handleReact(emoji);
                setShowMoreEmojis(false);
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  sheet: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 24,
  },
  reactionPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 14,
    flexWrap: 'nowrap',
    gap: 4,
  },
  reactionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  reactionEmoji: { fontSize: 22 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionText: { fontSize: 16, fontWeight: '600' },
  emojiOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  emojiSheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
});
