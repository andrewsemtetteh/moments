import { format } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useSendWatchMessage, useWatchMessages } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { useAuthStore, useRelationshipStore } from '@/stores';

export function WatchChatTray({ sessionId }: { sessionId: string }) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const partnerName = getFirstName(partner?.name) ?? 'Partner';

  const { data: messages = [] } = useWatchMessages(sessionId);
  const send = useSendWatchMessage(sessionId);
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length]);

  const handleSend = () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    send.mutate(value);
  };

  return (
    <View style={[styles.tray, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}>
        {messages.length === 0 ? (
          <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>
            Say something while you watch…
          </Text>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <View
                key={m.id}
                style={[
                  styles.bubble,
                  {
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    backgroundColor: mine ? colors.accent : colors.surfaceElevated,
                    borderColor: mine ? colors.accent : colors.border,
                  },
                ]}>
                {!mine && (
                  <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '700', marginBottom: 2 }}>
                    {partnerName}
                  </Text>
                )}
                <Text style={{ color: mine ? colors.onAccent : colors.text, fontSize: 14 }}>{m.message}</Text>
                <Text style={{ color: mine ? colors.onAccent : colors.textTertiary, fontSize: 9, opacity: 0.7, marginTop: 2, alignSelf: 'flex-end' }}>
                  {format(new Date(m.created_at), 'h:mm a')}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message…"
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated }]}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <Pressable
          onPress={handleSend}
          disabled={!text.trim()}
          style={[styles.sendBtn, { backgroundColor: colors.accent, opacity: text.trim() ? 1 : 0.45 }]}>
          <Icon name="send" size={18} color={colors.onAccent} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  list: { maxHeight: 220 },
  listContent: { padding: 12, gap: 8 },
  bubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
