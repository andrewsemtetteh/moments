import * as Haptics from '@/lib/haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TextInput } from '@/components/ui/ThemedTextInput';

import { Icon } from '@/components/ui/Icon';
import { NudgeButton } from '@/components/ui/NudgeButton';
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
import { getCachedPromptDraft, loadStoredPromptDraft, savePromptDraft } from '@/lib/prompt-draft';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { DailyChallenge } from '@/types/database';
import { useCardBorder } from '@/hooks/useCardBorder';

type Props = {
  challenge: DailyChallenge;
  onOpenHistory: () => void;
  /** Opened from an "Answer" button: go straight to the text box. */
  startComposing?: boolean;
};

export function TodaysPromptCard({ challenge, onOpenHistory, startComposing = false }: Props) {
  const { colors } = useTheme();
  const cardBorder = useCardBorder();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  // The answer box starts folded; tap to open. Leaving Home folds it again, and
  // whatever was typed stays (memory + storage) until it's sent.
  const [draft, setDraftState] = useState(() => getCachedPromptDraft(challenge.id));
  const [composing, setComposing] = useState(startComposing);
  const [sending, setSending] = useState(false);
  // Both answered: the answers stay folded until "See your answers", and fold again on leaving Home.
  const [showAnswers, setShowAnswers] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const setDraft = useCallback(
    (text: string) => {
      setDraftState(text);
      savePromptDraft(challenge.id, text);
    },
    [challenge.id],
  );

  // After an app restart only storage has it.
  useEffect(() => {
    if (getCachedPromptDraft(challenge.id)) return;
    let cancelled = false;
    void loadStoredPromptDraft(challenge.id).then((stored) => {
      if (!cancelled && stored) setDraftState((current) => current || stored);
    });
    return () => {
      cancelled = true;
    };
  }, [challenge.id]);

  useFocusEffect(
    useCallback(
      () => () => {
        inputRef.current?.blur();
        Keyboard.dismiss();
        setComposing(false);
        setShowAnswers(false);
      },
      [],
    ),
  );
  // Made once and kept (state, not a ref, so render never reads a ref).
  const [revealAnim] = useState(() => new Animated.Value(0));

  const phase = promptPhase(challenge, user?.id, relationship);
  const expired = isPromptExpired(challenge);
  const mine = myPromptResponse(challenge, user?.id, relationship);
  const theirs = partnerPromptResponse(challenge, user?.id, relationship);
  const busy = sending;

  useEffect(() => {
    if (phase !== 'reveal' || !showAnswers) {
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
  }, [phase, showAnswers, challenge.id, revealAnim]);

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
      setComposing(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Could not send', getErrorMessage(e) || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const header = (
    <View style={styles.topRow}>
      <Text style={[styles.kicker, { color: colors.textSecondary }]}>Today&apos;s question</Text>
      <Pressable onPress={onOpenHistory} hitSlop={10} style={styles.historyBtn} accessibilityRole="button" accessibilityLabel="Past questions">
        <Icon name="time" size={22} color={colors.tintAccents?.butter ?? colors.text} />
      </Pressable>
    </View>
  );

  if (expired && phase !== 'reveal') {
    return (
      <View style={[styles.card, { backgroundColor: colors.tints.butter }, cardBorder]}>
        {header}
        <Text style={[styles.prompt, { color: colors.text }]}>{challenge.prompt}</Text>
      </View>
    );
  }

  if (phase === 'waiting') {
    return (
      <View style={[styles.card, { backgroundColor: colors.tints.butter }, cardBorder]}>
        {header}
        <Text style={[styles.prompt, { color: colors.text }]}>{challenge.prompt}</Text>
        <PromptStatus challenge={challenge} />
      </View>
    );
  }

  if (phase === 'skipped') {
    return null;
  }

  if (phase === 'reveal' && mine && theirs && !showAnswers) {
    return (
      <View style={[styles.card, { backgroundColor: colors.tints.butter }, cardBorder]}>
        {header}
        <Text style={[styles.prompt, { color: colors.text }]}>{challenge.prompt}</Text>
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            setShowAnswers(true);
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.seeAnswers, { backgroundColor: colors.accent }, pressed && styles.pressed]}>
          <View style={styles.seeFaces}>
            {/* Both answered: each photo carries the green "answered" tick, like the status row. */}
            <View style={[styles.seeFace, { borderColor: colors.accent }]}>
              <Avatar name={user?.name} imageUrl={user?.avatar_url} size={24} />
              <View style={[styles.seeTick, { borderColor: colors.accent, backgroundColor: colors.success }]}>
                <Icon name="check" size={8} color="#fff" />
              </View>
            </View>
            <View style={[styles.seeFace, styles.seeFaceOverlap, { borderColor: colors.accent }]}>
              <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={24} />
              <View style={[styles.seeTick, { borderColor: colors.accent, backgroundColor: colors.success }]}>
                <Icon name="check" size={8} color="#fff" />
              </View>
            </View>
          </View>
          <Text style={[styles.seeAnswersText, { color: colors.onAccent }]}>See your answers</Text>
          <Icon name="chevronDown" size={18} color={colors.onAccent} />
        </Pressable>
      </View>
    );
  }

  if (phase === 'reveal' && mine && theirs) {
    return (
      <View style={[styles.card, { backgroundColor: colors.tints.butter }, cardBorder]}>
        {header}
        <Text style={[styles.prompt, { color: colors.text }]}>{challenge.prompt}</Text>
        <PromptStatus challenge={challenge} />
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
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            setShowAnswers(false);
          }}
          hitSlop={8}
          accessibilityRole="button"
          style={styles.hideAnswers}>
          <Text style={[styles.hideAnswersText, { color: colors.textSecondary }]}>Hide answers</Text>
          <Icon name="chevronDown" size={14} color={colors.textSecondary} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.tints.butter }, cardBorder]}>
      {header}
      <Text style={[styles.prompt, { color: colors.text }]}>{challenge.prompt}</Text>
      <PromptStatus challenge={challenge} />
      {composing ? (
        <>
          <TextInput
            ref={inputRef}
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
            autoFocus
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
        </>
      ) : (
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            setComposing(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={draft.trim() ? 'Continue your answer' : 'Write your answer'}
          style={({ pressed }) => [
            styles.collapsed,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderWidth: colors.boldBorder ? 2 : 1,
            },
            pressed && { opacity: 0.8 },
          ]}>
          <Text
            style={[styles.collapsedText, { color: draft.trim() ? colors.text : colors.textTertiary }]}
            numberOfLines={1}>
            {draft.trim() ? draft.trim() : 'Your answer…'}
          </Text>
          <Icon name="edit" size={18} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

/** One nudge per question every 30 minutes, so it stays a nudge and not a nag. */
const NUDGE_COOLDOWN_MS = 30 * 60_000;
/** Question id → when this phone last nudged for it (kept across remounts). */
const lastNudged = new Map<string, number>();

function canNudge(challengeId: string) {
  return Date.now() - (lastNudged.get(challengeId) ?? 0) >= NUDGE_COOLDOWN_MS;
}

/**
 * Who has answered today's question, plus one line saying what happens next.
 * Shared by Home and Play so every state reads the same:
 * - No partner yet: your avatar + an empty dashed slot; they'll see it once they join.
 * - Nobody answered: answer first and they get a nudge.
 * - They answered, you haven't: answer to see theirs.
 * - You answered, they haven't: waiting for them, with a Nudge.
 * - Both answered: both ticks green, above the two answers.
 */
export function PromptStatus({ challenge, ring }: { challenge: DailyChallenge; ring?: string }) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const mine = myPromptResponse(challenge, user?.id, relationship);
  const theirs = partnerPromptResponse(challenge, user?.id, relationship);
  const partnerFirst = getFirstName(partner?.name) ?? 'Your partner';
  const ringColor = ring ?? colors.surface;
  // Whether the Nudge was just sent (shows "Nudged" until the cooldown is over).
  const [nudged, setNudged] = useState(() => !canNudge(challenge.id));
  const [sending, setSending] = useState(false);

  /**
   * Tells your partner you're waiting: a notification in their inbox, a push on their
   * phone (if they allow Daily question alerts), and the Dynamic Island if Moments is open.
   */
  const sendNudge = async () => {
    if (!partner || !relationship?.id || !user || sending || !canNudge(challenge.id)) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSending(true);
    try {
      await api.sendPartnerNotification(
        relationship.id,
        partner.id,
        'challenge',
        `${getFirstName(user.name) ?? 'Your partner'} answered today’s question and is waiting for yours 💞`,
        { relatedId: challenge.id },
      );
      lastNudged.set(challenge.id, Date.now());
      setNudged(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Couldn’t send the nudge', 'Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  let line: string;
  let nudge = false;
  if (!partner) {
    line = mine ? 'You answered · they’ll see it when they join' : 'Your partner sees it once they join';
  } else if (mine && theirs) {
    line = 'You both answered';
  } else if (mine && !theirs) {
    line = `You answered · waiting for ${partnerFirst}`;
    nudge = true;
  } else if (theirs && !mine) {
    line = `${partnerFirst} answered · answer to see theirs`;
  } else {
    line = `Answer first and ${partnerFirst} gets a nudge`;
  }

  return (
    <View style={styles.status}>
      <View style={styles.statusAvatars}>
        <AnsweredAvatar done={!!mine} name={user?.name} url={user?.avatar_url} ring={ringColor} colors={colors} />
        <View style={styles.statusOverlap}>
          {partner ? (
            <AnsweredAvatar done={!!theirs} name={partner.name} url={partner.avatar_url} ring={ringColor} colors={colors} />
          ) : (
            <View style={[styles.emptySlot, { borderColor: colors.textTertiary, backgroundColor: ringColor }]} />
          )}
        </View>
      </View>
      <Text style={[styles.statusText, { color: colors.textSecondary }]} numberOfLines={2}>
        {line}
      </Text>
      {nudge ? (
        <NudgeButton name={partnerFirst} nudged={nudged} busy={sending} onPress={() => void sendNudge()} />
      ) : null}
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
  seeAnswers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 26,
    marginTop: 4,
  },
  seeFaces: { flexDirection: 'row' },
  seeFace: { borderRadius: 14, borderWidth: 2 },
  seeFaceOverlap: { marginLeft: -9 },
  seeTick: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeAnswersText: { fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  hideAnswers: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 2 },
  hideAnswersText: { fontSize: 13, fontWeight: '700' },
  card: { borderRadius: 22, padding: 16, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontSize: 14, fontWeight: '800' },
  historyBtn: { width: 36, height: 36, marginRight: -8, marginVertical: -8, alignItems: 'center', justifyContent: 'center' },
  prompt: { fontSize: 19, fontWeight: '800', lineHeight: 25, letterSpacing: -0.3 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusAvatars: { flexDirection: 'row' },
  statusOverlap: { marginLeft: -8 },
  emptySlot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderStyle: 'dashed' },
  statusText: { flex: 1, fontSize: 13, fontWeight: '600' },
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
  collapsed: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  collapsedText: { flex: 1, fontSize: 16 },
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
