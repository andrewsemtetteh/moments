import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { consumeTourPending } from '@/lib/onboarding-v2';
import { useAuthStore, useUIStore } from '@/stores';

type Step = {
  icon: IconName;
  title: string;
  body: string;
  /** Where the card sits, pointing at the part of Home it explains. */
  place: 'top' | 'middle' | 'bottom';
  action?: { label: string; run: () => void };
};

/**
 * The tour right after onboarding: four short cards over Home, pointing at
 * your space, sending a moment, today's question and moods, and getting
 * around. Skippable at any point; shown once.
 */
export function OnboardingTour() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const setShowMomentCreator = useUIStore((s) => s.setShowMomentCreator);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void consumeTourPending(userId).then((pending) => {
        if (!cancelled && pending) setVisible(true);
      });
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId]);

  const close = () => {
    setVisible(false);
    setIndex(0);
  };

  const steps: Step[] = [
    {
      icon: 'heart',
      title: 'This is your space',
      body: 'Your person appears here the moment they join. Show up together every day to grow your streak; the week fills in below.',
      place: 'top',
    },
    {
      icon: 'question',
      title: 'Check in every day',
      body: 'Tap how you’re feeling, and answer today’s question. You see each other’s answer once you’ve both replied.',
      place: 'middle',
    },
    {
      icon: 'camera',
      title: 'Send your first moment',
      body: 'A photo or short video of right now. It’s the first thing your person sees when they open Moments.',
      place: 'bottom',
      action: {
        label: 'Open camera',
        run: () => {
          close();
          setTimeout(() => setShowMomentCreator(true), 250);
        },
      },
    },
    {
      icon: 'gamepad',
      title: 'Swipe to get around',
      body: 'Swipe right for Together (plans and memories), left for Play and You. Chat is at the top.',
      place: 'bottom',
    },
  ];
  const step = steps[index];
  const last = index === steps.length - 1;

  if (!visible) return null;

  const position =
    step.place === 'top'
      ? { top: insets.top + 230 }
      : step.place === 'middle'
        ? { top: '40%' as const }
        : { bottom: insets.bottom + 120 };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Animated.View entering={FadeIn.duration(220)} style={[StyleSheet.absoluteFill, styles.dim]} />
      <Animated.View
        key={index}
        entering={FadeInDown.duration(320)}
        style={[styles.card, position, { backgroundColor: colors.background, borderColor: colors.text }]}>
        <View style={styles.head}>
          <View style={[styles.tile, { backgroundColor: colors.accent }]}>
            <Icon name={step.icon} size={20} color={colors.onAccent} />
          </View>
          <Text style={[styles.count, { color: colors.textSecondary }]}>
            {index + 1} of {steps.length}
          </Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{step.title}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{step.body}</Text>
        <View style={styles.dots}>
          {steps.map((s, i) => (
            <View
              key={s.title}
              style={[styles.dot, { backgroundColor: i === index ? colors.text : colors.border, width: i === index ? 18 : 6 }]}
            />
          ))}
        </View>
        <View style={styles.row}>
          <Pressable onPress={close} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.skip, { color: colors.textSecondary }]}>{last ? 'Done' : 'Skip tour'}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              if (step.action) step.action.run();
              else if (last) close();
              else setIndex(index + 1);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.next, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}>
            <Text style={[styles.nextText, { color: colors.onAccent }]}>{step.action?.label ?? (last ? 'Let’s go' : 'Next')}</Text>
          </Pressable>
        </View>
        {step.action ? (
          <Pressable onPress={() => setIndex(index + 1)} hitSlop={8} style={styles.later}>
            <Text style={[styles.skip, { color: colors.textSecondary }]}>Later, keep going</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(0,0,0,0.6)' },
  card: { position: 'absolute', left: 16, right: 16, borderRadius: 24, borderWidth: 2, padding: 18, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 12, fontWeight: '900' },
  title: { fontSize: 21, fontWeight: '900', letterSpacing: -0.3, marginTop: 4 },
  body: { fontSize: 15, lineHeight: 21 },
  dots: { flexDirection: 'row', gap: 5, marginTop: 4 },
  dot: { height: 6, borderRadius: 3 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  skip: { fontSize: 14, fontWeight: '700' },
  next: { height: 44, paddingHorizontal: 22, borderRadius: 22, justifyContent: 'center' },
  nextText: { fontSize: 15, fontWeight: '800' },
  later: { alignSelf: 'flex-end', paddingTop: 4 },
});
