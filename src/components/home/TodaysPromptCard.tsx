import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Avatar, Card, PrimaryButton } from '@/components/ui/primitives';
import { useRespondToDailyChallenge } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import {
    isPromptExpired,
    myPromptResponse,
    partnerPromptResponse,
    promptAuthorLabel,
    promptPhase,
} from '@/lib/daily-prompt';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { DailyChallenge } from '@/types/database';

type Props = {
  challenge: DailyChallenge;
  onOpenHistory: () => void;
};

export function TodaysPromptCard({ challenge, onOpenHistory }: Props) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const respond = useRespondToDailyChallenge();
  const [draft, setDraft] = useState('');
  const revealAnim = useRef(new Animated.Value(0)).current;

  const phase = promptPhase(challenge, user?.id, relationship);
  const expired = isPromptExpired(challenge);
  const mine = myPromptResponse(challenge, user?.id, relationship);
  const theirs = partnerPromptResponse(challenge, user?.id, relationship);
  const partnerFirst = getFirstName(partner?.name) ?? 'Your partner';
  const busy = respond.isPending;

  useEffect(() => {
    if (phase !== 'reveal') {
      revealAnim.setValue(0);
      return;
    }
    revealAnim.setValue(0);
    Animated.spring(revealAnim, {
      toValue: 1,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [phase, challenge.id, revealAnim]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    try {
      await respond.mutateAsync({ challengeId: challenge.id, response: text });
      setDraft('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Could not send', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const header = (
    <View style={styles.topRow}>
      <Text style={[styles.kicker, { color: colors.textSecondary }]}>Today&apos;s question</Text>
      <Pressable onPress={onOpenHistory} hitSlop={8} accessibilityRole="button">
        <Text style={[styles.historyLink, { color: colors.accent }]}>History</Text>
      </Pressable>
    </View>
  );

  if (expired && phase !== 'reveal') {
    return (
      <Card style={styles.card}>
        {header}
        <Text style={[styles.prompt, { color: colors.text }]}>{challenge.prompt}</Text>
      </Card>
    );
  }

  if (phase === 'waiting') {
    return (
      <Card style={styles.card}>
        {header}
        <View style={styles.waitCenter}>
          <View style={[styles.clockRing, { backgroundColor: colors.accentSoft }]}>
            <Icon name="time" size={28} color={colors.accent} />
          </View>
          <Text style={[styles.waitTitle, { color: colors.text }]}>Your answer is locked in</Text>
          <Text style={[styles.waitSub, { color: colors.textSecondary }]}>
            Waiting for {partnerFirst}&apos;s answer — you&apos;ll both see them together.
          </Text>
          <View style={styles.statusRow}>
            <StatusChip
              done
              label="You"
              colors={colors}
            />
            <StatusChip
              done={false}
              label={partnerFirst}
              colors={colors}
            />
          </View>
        </View>
      </Card>
    );
  }

  if (phase === 'skipped') {
    return null;
  }

  if (phase === 'reveal' && mine && theirs) {
    return (
      <Card style={styles.card}>
        {header}
        <Text style={[styles.prompt, { color: colors.text }]}>{challenge.prompt}</Text>
        <Animated.View
          style={[
            styles.reveal,
            {
              opacity: revealAnim,
              transform: [
                {
                  translateY: revealAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}>
          <AnswerBubble
            label="You"
            text={mine}
            colors={colors}
            avatarName={user?.name}
            avatarUrl={user?.avatar_url}
            mine
          />
          <AnswerBubble
            label={promptAuthorLabel(false, user, partner)}
            text={theirs}
            colors={colors}
            avatarName={partner?.name}
            avatarUrl={partner?.avatar_url}
          />
        </Animated.View>
      </Card>
    );
  }

  // Compose (answer) state
  return (
    <Card style={styles.card}>
      {header}
      <Text style={[styles.prompt, { color: colors.text }]}>{challenge.prompt}</Text>
      {!!theirs && (
        <Text style={[styles.partnerWaiting, { color: colors.textSecondary }]}>
          {partnerFirst} is waiting for your answer
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
          },
        ]}
        placeholder="Type your answer..."
        placeholderTextColor={colors.textTertiary}
        value={draft}
        onChangeText={setDraft}
        multiline
        textAlignVertical="top"
        editable={!busy}
      />
      <PrimaryButton
        label={busy ? 'Sending…' : 'Submit answer'}
        onPress={submit}
        disabled={!draft.trim() || busy}
        loading={respond.isPending}
        style={styles.submitBtn}
      />
    </Card>
  );
}

function StatusChip({
  done,
  label,
  colors,
}: {
  done: boolean;
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={styles.chip}>
      <View
        style={[
          styles.chipIcon,
          { backgroundColor: done ? colors.success : colors.surfaceElevated },
        ]}>
        <Icon name={done ? 'check' : 'time'} size={14} color={done ? '#fff' : colors.textTertiary} />
      </View>
      <Text style={[styles.chipLabel, { color: colors.text }]}>{label}</Text>
    </View>
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
  card: { gap: 14, paddingVertical: 18 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontSize: 13, fontWeight: '600' },
  historyLink: { fontSize: 13, fontWeight: '700' },
  prompt: { fontSize: 22, fontWeight: '800', lineHeight: 30, letterSpacing: -0.4, textAlign: 'center' },
  partnerWaiting: { fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  input: {
    minHeight: 110,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    lineHeight: 22,
  },
  submitBtn: { marginTop: 2 },
  waitCenter: { alignItems: 'center', paddingVertical: 12, gap: 10 },
  clockRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  waitTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  waitSub: { fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: { fontSize: 15, fontWeight: '700' },
  reveal: { gap: 12 },
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
