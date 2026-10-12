import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
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
import { Avatar, PrimaryButton } from '@/components/ui/primitives';
import { dailyChallengeQueryKey } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { setCachedDailyChallenge } from '@/lib/daily-challenge-cache';
import {
  isPromptExpired,
  myPromptResponse,
  partnerPromptResponse,
  promptAuthorLabel,
  promptPhase,
} from '@/lib/daily-prompt';
import { getErrorMessage } from '@/lib/network-error';
import { openChat } from '@/lib/router';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { DailyChallenge } from '@/types/database';

type Props = {
  challenge: DailyChallenge;
  onOpenHistory: () => void;
};

export function TodaysPromptCard({ challenge, onOpenHistory }: Props) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const revealAnim = useRef(new Animated.Value(0)).current;

  const phase = promptPhase(challenge, user?.id, relationship);
  const expired = isPromptExpired(challenge);
  const mine = myPromptResponse(challenge, user?.id, relationship);
  const theirs = partnerPromptResponse(challenge, user?.id, relationship);
  const partnerFirst = getFirstName(partner?.name) ?? 'Your partner';
  const busy = sending;

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
    if (!user?.id || !relationship) {
      Alert.alert('Could not send', 'You need to be signed in with an active relationship.');
      return;
    }

    setSending(true);
    try {
      const updated = await api.respondToDailyChallenge(
        challenge.id,
        user.id,
        relationship,
        text,
        user.name,
      );

      queryClient.setQueryData(
        dailyChallengeQueryKey(relationship.id, updated.challenge_date),
        updated,
      );
      queryClient.setQueryData(dailyChallengeQueryKey(relationship.id), updated);
      void setCachedDailyChallenge(updated);
      void queryClient.invalidateQueries({ queryKey: ['daily-challenge-history', relationship.id] });
      void queryClient.invalidateQueries({ queryKey: ['streak', relationship.id] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount'] });

      setDraft('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Could not send', getErrorMessage(e) || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const answerStatus = (line: string, action?: { label: string; onPress: () => void }) => (
    <View style={styles.status}>
      <View style={styles.statusAvatars}>
        <AnsweredAvatar done={!!mine} name={user?.name} url={user?.avatar_url} ring={colors.surface} colors={colors} />
        <View style={styles.statusOverlap}>
          <AnsweredAvatar done={!!theirs} name={partner?.name} url={partner?.avatar_url} ring={colors.surface} colors={colors} />
        </View>
      </View>
      <Text style={[styles.statusText, { color: colors.textSecondary }]} numberOfLines={2}>
        {line}
      </Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          style={({ pressed }) => [styles.nudge, { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.8 }]}>
          <Text style={[styles.nudgeText, { color: colors.accent }]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const header = (
    <View style={styles.topRow}>
      <Text style={[styles.kicker, { color: colors.accent }]}>Today&apos;s question</Text>
      <Pressable onPress={onOpenHistory} hitSlop={10} style={styles.historyBtn} accessibilityRole="button" accessibilityLabel="Past questions">
        <Icon name="time" size={22} color={colors.text} />
      </Pressable>
    </View>
  );

  if (expired && phase !== 'reveal') {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {header}
        <Text style={[styles.prompt, { color: colors.text }]}>{challenge.prompt}</Text>
      </View>
    );
  }

  if (phase === 'waiting') {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {header}
        <Text style={[styles.prompt, { color: colors.text }]}>{challenge.prompt}</Text>
        {answerStatus(`You answered · waiting for ${partnerFirst}`, {
          label: 'Nudge',
          onPress: () => {
            void Haptics.selectionAsync();
            openChat(`Answer today’s question when you get a sec 💞`);
          },
        })}
      </View>
    );
  }

  if (phase === 'skipped') {
    return null;
  }

  if (phase === 'reveal' && mine && theirs) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
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
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      {header}
      <Text style={[styles.prompt, { color: colors.text }]}>{challenge.prompt}</Text>
      {answerStatus(
        theirs ? `${partnerFirst} answered · your turn` : 'Answer to see each other’s',
      )}
      <TextInput
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.background,
            borderColor: colors.border,
            borderWidth: colors.boldBorder ? 2 : 1,
          },
        ]}
        placeholder="Your answer…"
        placeholderTextColor={colors.textTertiary}
        value={draft}
        onChangeText={setDraft}
        multiline
        textAlignVertical="top"
        editable={!busy}
      />
      <PrimaryButton
        label={busy ? 'Sending…' : 'Submit answer'}
        onPress={() => {
          void submit();
        }}
        disabled={!draft.trim() || busy}
        loading={busy}
        style={styles.submitBtn}
      />
    </View>
  );
}

function AnsweredAvatar({
  done,
  name,
  url,
  ring,
  colors,
}: {
  done: boolean;
  name?: string | null;
  url?: string | null;
  ring: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[styles.answeredAvatar, { borderColor: ring }]}>
      <Avatar name={name} imageUrl={url} size={26} />
      <View
        style={[
          styles.answeredBadge,
          { borderColor: ring, backgroundColor: done ? colors.success : colors.surfaceElevated },
        ]}>
        {done ? <Icon name="check" size={9} color="#fff" /> : null}
      </View>
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
          borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth,
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
  card: { borderRadius: 22, padding: 16, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontSize: 14, fontWeight: '800' },
  historyBtn: { width: 36, height: 36, marginRight: -8, marginVertical: -8, alignItems: 'center', justifyContent: 'center' },
  prompt: { fontSize: 19, fontWeight: '800', lineHeight: 25, letterSpacing: -0.3 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusAvatars: { flexDirection: 'row' },
  statusOverlap: { marginLeft: -8 },
  statusText: { flex: 1, fontSize: 13, fontWeight: '600' },
  nudge: { height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center' },
  nudgeText: { fontSize: 13, fontWeight: '800' },
  answeredAvatar: { borderWidth: 2, borderRadius: 15 },
  answeredBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    lineHeight: 22,
  },
  submitBtn: { marginTop: 2 },
  reveal: { gap: 12 },
  bubble: {
    borderRadius: 16,
    borderWidth: 0,
    padding: 14,
    gap: 8,
  },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bubbleLabel: { flex: 1, fontSize: 13, fontWeight: '700' },
  bubbleText: { fontSize: 15, lineHeight: 22 },
});
