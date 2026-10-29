import * as Haptics from '@/lib/haptics';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { playCardStyle } from '@/components/play/PlayKit';
import { Icon } from '@/components/ui/Icon';
import { TextInput } from '@/components/ui/ThemedTextInput';
import { useTheme } from '@/hooks/useTheme';

/** The end of a set or game: a note about it, sent to your chat. */
export function CommentBox({
  accent,
  partner,
  placeholder = 'That last one surprised me…',
  onSend,
}: {
  accent: string;
  partner: string;
  placeholder?: string;
  onSend: (text: string) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    const clean = text.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      await onSend(clean);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
      setText('');
    } catch {
      Alert.alert('Couldn’t send', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, playCardStyle(colors)]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>{sent ? 'Sent to your chat' : `Say something to ${partner} about it`}</Text>
        {sent ? <Icon name="check" size={16} color={accent} /> : null}
      </View>
      <View style={[styles.box, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={sent ? 'Add another note…' : placeholder}
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={500}
          accessibilityLabel="Your note about it"
          style={[styles.input, { color: colors.text }]}
        />
        <Pressable
          onPress={() => void send()}
          disabled={!text.trim() || busy}
          accessibilityRole="button"
          accessibilityLabel="Send to chat"
          hitSlop={6}
          style={[styles.send, { backgroundColor: accent, opacity: text.trim() && !busy ? 1 : 0.4 }]}>
          <Icon name="send" size={16} color="#FFFFFF" filled />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: 15, fontWeight: '800' },
  box: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 5,
  },
  input: { flex: 1, fontSize: 15, lineHeight: 20, maxHeight: 120, minHeight: 34, paddingVertical: 7 },
  send: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
