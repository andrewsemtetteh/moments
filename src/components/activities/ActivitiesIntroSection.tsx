import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TodaysPromptCard } from '@/components/home/TodaysPromptCard';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { promptPhase } from '@/lib/daily-prompt';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { DailyChallenge } from '@/types/database';

interface ActivitiesIntroSectionProps {
  challenge?: DailyChallenge | null;
  partnerName?: string | null;
  onOpenHistory: () => void;
}

/**
 * Play hero + compact today's-question teaser.
 * Answer expands to the same TodaysPromptCard used on Home (no modal).
 */
export function ActivitiesIntroSection({
  challenge,
  partnerName,
  onOpenHistory,
}: ActivitiesIntroSectionProps) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const relationship = useRelationshipStore((s) => s.relationship);
  const [answering, setAnswering] = useState(false);
  const partnerFirst = getFirstName(partnerName) ?? 'your partner';

  const phase = challenge ? promptPhase(challenge, user?.id, relationship) : null;
  // Full card when answering, or when there's nothing left to "Answer" (waiting / reveal).
  const showFullCard = !!challenge && (answering || phase === 'waiting' || phase === 'reveal');

  // Tabs stay mounted — collapse unanswered form whenever Play loses focus.
  useFocusEffect(
    useCallback(() => {
      return () => setAnswering(false);
    }, []),
  );

  const openAnswer = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnswering(true);
  };

  return (
    <View style={styles.section}>
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, !challenge && styles.heroSolo]}>
        <View style={styles.heroGlow} pointerEvents="none" />
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <Icon name="gamepad" size={26} color="#fff" filled />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>PLAY TOGETHER</Text>
            <Text style={styles.heroTitle}>We&apos;re bored?</Text>
            <Text style={styles.heroSub}>
              Pick something fun for you and {partnerFirst} below.
            </Text>
          </View>
        </View>
      </LinearGradient>

      {challenge && !showFullCard ? (
        <View
          style={[
            styles.challengePanel,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}>
          <View style={styles.challengeHeader}>
            <Icon name="question" size={14} color={colors.accent} />
            <Text style={[styles.challengeLabel, { color: colors.textSecondary }]}>
              Today&apos;s question
            </Text>
          </View>
          <Text style={[styles.challengeText, { color: colors.text }]}>{challenge.prompt}</Text>
          <Pressable
            onPress={openAnswer}
            style={[styles.answerBtn, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Answer today's question">
            <Text style={[styles.answerBtnText, { color: colors.onAccent }]}>Answer</Text>
            <Icon name="chevronRight" size={16} color={colors.onAccent} />
          </Pressable>
        </View>
      ) : null}

      {challenge && showFullCard ? (
        <View style={styles.challengeWrap}>
          <TodaysPromptCard challenge={challenge} onOpenHistory={onOpenHistory} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 0 },
  hero: {
    borderRadius: 24,
    padding: 20,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  heroSolo: { paddingBottom: 20 },
  heroGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.12)',
    top: -60,
    right: -40,
  },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flex: 1, gap: 4 },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: 2,
  },
  challengePanel: {
    marginTop: -18,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  challengeLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  challengeText: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
  },
  answerBtn: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  answerBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  challengeWrap: {
    marginTop: -18,
  },
});
