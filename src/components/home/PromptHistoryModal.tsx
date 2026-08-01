import { format, formatDistanceToNowStrict, isYesterday, parseISO, startOfDay } from 'date-fns';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useDailyChallengeHistory } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import {
  isPromptComplete,
  myPromptResponse,
  partnerPromptResponse,
  promptAuthorLabel,
  promptHistoryStatus,
} from '@/lib/daily-prompt';
import { getFirstName } from '@/lib/avatar-initial';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { DailyChallenge } from '@/types/database';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function historyDateLabel(dateStr: string): string {
  try {
    const date = startOfDay(parseISO(dateStr));
    const today = startOfDay(new Date());
    if (date.getTime() === today.getTime()) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return formatDistanceToNowStrict(date, { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function PromptHistoryModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const { data: entries = [], isLoading } = useDailyChallengeHistory();
  const [selected, setSelected] = useState<DailyChallenge | null>(null);
  const partnerFirst = getFirstName(partner?.name) ?? 'Your partner';

  const close = () => {
    setSelected(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => (selected ? setSelected(null) : close())}
            hitSlop={12}
            style={styles.headerBtn}
            accessibilityLabel={selected ? 'Back' : 'Close'}>
            <Icon name={selected ? 'chevronLeft' : 'close'} size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {selected ? format(parseISO(selected.challenge_date), 'MMM d, yyyy') : 'Your history'}
          </Text>
          <View style={styles.headerBtn} />
        </View>

        {selected ? (
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}>
            <Text style={[styles.detailPrompt, { color: colors.text }]}>{selected.prompt}</Text>
            {isPromptComplete(selected) ? (
              <View style={styles.detailAnswers}>
                <AnswerBubble
                  label="You"
                  text={myPromptResponse(selected, user?.id, relationship) ?? ''}
                  colors={colors}
                  avatarName={user?.name}
                  avatarUrl={user?.avatar_url}
                  mine
                />
                <AnswerBubble
                  label={promptAuthorLabel(false, user, partner)}
                  text={partnerPromptResponse(selected, user?.id, relationship) ?? ''}
                  colors={colors}
                  avatarName={partner?.name}
                  avatarUrl={partner?.avatar_url}
                />
              </View>
            ) : (
              <Text style={[styles.empty, { color: colors.textTertiary }]}>
                {promptHistoryStatus(selected, user?.id, relationship, partnerFirst)}
              </Text>
            )}
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}>
            {isLoading && (
              <Text style={[styles.empty, { color: colors.textTertiary }]}>Loading…</Text>
            )}

            {!isLoading && entries.length === 0 && (
              <Text style={[styles.empty, { color: colors.textTertiary }]}>No prompts yet</Text>
            )}

            {entries.map((entry) => {
              const complete = isPromptComplete(entry);
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => setSelected(entry)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: complete ? (pressed ? 0.9 : 1) : 0.65,
                    },
                  ]}>
                  <Text style={[styles.date, { color: colors.textTertiary }]}>
                    {historyDateLabel(entry.challenge_date)}
                  </Text>
                  <Text
                    style={[styles.prompt, { color: complete ? colors.text : colors.textSecondary }]}
                    numberOfLines={2}>
                    {entry.prompt}
                  </Text>
                  <Text style={[styles.badge, { color: colors.textSecondary }]}>
                    {promptHistoryStatus(entry, user?.id, relationship, partnerFirst)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function AnswerBubble({
  label,
  text,
  colors,
  avatarName,
  avatarUrl,
  mine,
}: {
  label: string;
  text: string;
  colors: ReturnType<typeof useTheme>['colors'];
  avatarName?: string | null;
  avatarUrl?: string | null;
  mine?: boolean;
}) {
  return (
    <View
      style={[
        styles.bubble,
        {
          backgroundColor: mine ? colors.accentSoft : colors.surfaceElevated,
          borderColor: colors.border,
        },
      ]}>
      <View style={styles.bubbleHead}>
        <Avatar name={avatarName} imageUrl={avatarUrl} size={24} />
        <Text style={[styles.bubbleLabel, { color: colors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.bubbleText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  scroll: { paddingHorizontal: 16, gap: 12 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 14 },
  row: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 6,
  },
  date: { fontSize: 13, fontWeight: '600' },
  prompt: { fontSize: 17, fontWeight: '800', lineHeight: 24, letterSpacing: -0.2 },
  badge: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  detailPrompt: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  detailAnswers: { gap: 12 },
  bubble: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
  },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bubbleLabel: { flex: 1, fontSize: 13, fontWeight: '700' },
  bubbleText: { fontSize: 15, lineHeight: 22 },
});
