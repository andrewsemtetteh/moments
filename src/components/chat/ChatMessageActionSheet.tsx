import { format, isToday, isYesterday } from 'date-fns';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { ChatEmojiPicker } from '@/components/chat/ChatEmojiPicker';
import { Icon, type IconName } from '@/components/ui/Icon';
import { REACTION_EMOJI } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { downloadMomentMedia } from '@/lib/download-moment-media';
import * as Haptics from '@/lib/haptics';
import { getMessagePreviewText } from '@/lib/message-preview';
import { MESSAGE_EDIT_WINDOW_MS } from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { Message } from '@/types/database';

interface Props {
  message: Message | null;
  onClose: () => void;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onReact: (messageId: string, emoji: string) => void;
  onPin: (messageId: string, isPinned: boolean) => void;
  onDeleteForMe: (messageId: string) => void;
  onDeleteForAll: (messageId: string) => void;
}

/** Still inside the window where the sender may edit it. */
function canStillEdit(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < MESSAGE_EDIT_WINDOW_MS;
}

function when(iso: string) {
  const d = new Date(iso);
  const time = format(d, 'h:mm a');
  if (isToday(d)) return `Today, ${time}`;
  if (isYesterday(d)) return `Yesterday, ${time}`;
  return format(d, "d MMM yyyy, h:mm a");
}

/**
 * Long-press menu for a chat message, modelled on iMessage / WhatsApp / Telegram:
 * - Reactions on top (yours highlighted; tap it again to remove), "+" for any emoji.
 * - The message you pressed, so it's clear what the actions apply to.
 * - Only the actions that make sense for it: Reply, Copy (text), Edit (your text,
 *   first 15 minutes), Save (photo/video), Share, Pin, Info (your messages: sent /
 *   read), Delete (for me, or for everyone on your own).
 */
export function ChatMessageActionSheet({
  message,
  onClose,
  onReply,
  onEdit,
  onReact,
  onPin,
  onDeleteForMe,
  onDeleteForAll,
}: Props) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const [showMoreEmojis, setShowMoreEmojis] = useState(false);

  if (!message) return null;

  const isTemp = message.id.startsWith('temp-');
  const isSelf = message.sender_id === user?.id;
  const deleted = !!message.deleted_for_all;
  const text = message.content?.trim() ?? '';
  const hasMedia = !!message.media_url && !deleted;
  const isPhotoOrVideo = hasMedia && (message.media_type === 'image' || message.media_type === 'video');
  const canEdit =
    isSelf &&
    !isTemp &&
    !deleted &&
    !!text &&
    !message.media_url &&
    canStillEdit(message.created_at);
  const myReaction = Object.entries(message.reactions ?? {}).find(([, ids]) => user && ids.includes(user.id))?.[0];
  const partnerFirst = partner?.name?.trim().split(/\s+/)[0] || 'Your partner';

  const close = () => {
    setShowMoreEmojis(false);
    onClose();
  };

  const react = (emoji: string) => {
    if (!isTemp) onReact(message.id, emoji);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    close();
  };

  const copy = async () => {
    await Clipboard.setStringAsync(text);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    close();
  };

  const save = () => {
    close();
    if (message.media_url) void downloadMomentMedia(message.media_url, message.media_type === 'video');
  };

  const share = () => {
    close();
    const url = hasMedia ? message.media_url ?? undefined : undefined;
    void Share.share(url ? { url, message: text || url } : { message: text }).catch(() => undefined);
  };

  const info = () => {
    close();
    const lines = [`Sent: ${when(message.created_at)}`];
    if (message.edited_at) lines.push(`Edited: ${when(message.edited_at)}`);
    lines.push(message.read_at ? `Read by ${partnerFirst}: ${when(message.read_at)}` : `Not read by ${partnerFirst} yet`);
    Alert.alert('Message info', lines.join('\n'));
  };

  const remove = () => {
    close();
    Alert.alert('Delete message?', isSelf ? 'Delete it just for you, or for both of you.' : undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete for me', onPress: () => onDeleteForMe(message.id) },
      ...(isSelf && !deleted
        ? [{ text: 'Delete for everyone', style: 'destructive' as const, onPress: () => onDeleteForAll(message.id) }]
        : []),
    ]);
  };

  type Action = { key: string; icon: IconName; label: string; onPress: () => void; danger?: boolean };
  const actions: Action[] = [];
  if (!deleted) actions.push({ key: 'reply', icon: 'reply', label: 'Reply', onPress: () => (onReply(message), close()) });
  if (!deleted && text) actions.push({ key: 'copy', icon: 'cards', label: 'Copy', onPress: () => void copy() });
  if (canEdit) actions.push({ key: 'edit', icon: 'edit', label: 'Edit', onPress: () => (onEdit(message), close()) });
  if (isPhotoOrVideo) actions.push({ key: 'save', icon: 'download', label: 'Save to Photos', onPress: save });
  if (!deleted && (text || hasMedia)) actions.push({ key: 'share', icon: 'share', label: 'Share', onPress: share });
  if (!isTemp && !deleted) {
    actions.push({
      key: 'pin',
      icon: 'pin',
      label: message.is_pinned ? 'Unpin' : 'Pin',
      onPress: () => (onPin(message.id, !message.is_pinned), close()),
    });
  }
  if (isSelf && !isTemp && !deleted) actions.push({ key: 'info', icon: 'info', label: 'Info', onPress: info });
  if (!isTemp) actions.push({ key: 'delete', icon: 'trash', label: 'Delete', onPress: remove, danger: true });

  // One shared Modal whose content swaps (reactions/actions vs the full emoji picker):
  // two Modals trading `visible` flashed the chat underneath for a frame.
  return (
    <Modal visible transparent animationType="fade" onRequestClose={showMoreEmojis ? () => setShowMoreEmojis(false) : close}>
      {showMoreEmojis ? (
        <Pressable style={styles.emojiOverlay} onPress={() => setShowMoreEmojis(false)}>
          <View style={styles.emojiSheet} onStartShouldSetResponder={() => true}>
            <ChatEmojiPicker onSelect={react} />
          </View>
        </Pressable>
      ) : (
        <Pressable style={styles.overlay} onPress={close}>
          <View style={styles.stack} onStartShouldSetResponder={() => true}>
            {!deleted && !isTemp ? (
              <View style={[styles.reactions, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                {REACTION_EMOJI.map((emoji) => {
                  const on = myReaction === emoji;
                  return (
                    <Pressable
                      key={emoji}
                      onPress={() => react(emoji)}
                      accessibilityRole="button"
                      accessibilityLabel={on ? `Remove ${emoji} reaction` : `React ${emoji}`}
                      accessibilityState={{ selected: on }}
                      style={({ pressed }) => [
                        styles.reactionBtn,
                        on && { backgroundColor: colors.accentSoft },
                        pressed && styles.pressed,
                      ]}>
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => setShowMoreEmojis(true)}
                  accessibilityRole="button"
                  accessibilityLabel="More reactions"
                  style={({ pressed }) => [styles.reactionBtn, { backgroundColor: colors.surface }, pressed && styles.pressed]}>
                  <Icon name="plus" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : null}

            {/* The message the actions apply to. */}
            <View
              style={[
                styles.preview,
                isSelf ? styles.previewSelf : styles.previewOther,
                { backgroundColor: isSelf ? colors.accent : colors.surfaceElevated, borderColor: colors.border },
              ]}>
              <Text
                style={[styles.previewText, { color: isSelf ? colors.onAccent : colors.text }]}
                numberOfLines={4}>
                {deleted ? 'This message was deleted' : getMessagePreviewText(message)}
              </Text>
            </View>

            <ScrollView
              style={[styles.menu, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              bounces={false}>
              {actions.map((a, i) => (
                <Pressable
                  key={a.key}
                  onPress={a.onPress}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.action,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                    pressed && { backgroundColor: colors.surface },
                  ]}>
                  <Text style={[styles.actionText, { color: a.danger ? colors.error : colors.text }]}>{a.label}</Text>
                  <Icon name={a.icon} size={20} color={a.danger ? colors.error : colors.text} filled={a.key === 'pin' && message.is_pinned} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', padding: 16, paddingBottom: 40 },
  stack: { gap: 10 },
  pressed: { opacity: 0.6 },
  reactions: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 6,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reactionBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  reactionEmoji: { fontSize: 26 },
  preview: { maxWidth: '82%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  previewSelf: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  previewOther: { alignSelf: 'flex-start', borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  previewText: { fontSize: 16, lineHeight: 21 },
  menu: { flexGrow: 0, maxHeight: 420, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  action: {
    minHeight: 50,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionText: { fontSize: 16, fontWeight: '600' },
  emojiOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  emojiSheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
});
