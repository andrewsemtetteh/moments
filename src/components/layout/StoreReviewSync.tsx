import * as Haptics from '@/lib/haptics';
import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { TextInput } from '@/components/ui/ThemedTextInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoupleCharacters } from '@/components/onboarding/Characters';
import { Icon } from '@/components/ui/Icon';
import { useStreak } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import {
  ensureStoreReviewFirstOpen,
  markRatingFeedbackGiven,
  markRatingPageDismissed,
  markStoreReviewCompleted,
  openStoreReview,
  sendFeedbackByEmail,
  shouldShowRatingPage,
  STORE_NAME,
} from '@/lib/store-review';
import { ThemedStatusBar } from '@/components/ui/ThemedStatusBar';
import { trackForCouple } from '@/services/analytics';

/**
 * The rating ask: a full page of our own, shown once they've used Moments on 7
 * different days; if closed, again no sooner than 4 days later; never again
 * once they've gone to rate.
 */
export function StoreReviewSync() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    void ensureStoreReviewFirstOpen();
    const timer = setTimeout(() => {
      void shouldShowRatingPage().then((show) => {
        if (show) setVisible(true);
      });
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;
  return <RatingPage onDone={() => setVisible(false)} />;
}

type Step = 'ask' | 'rate' | 'feedback' | 'thanks';

/**
 * Apps can't post a rating themselves, and a star picker of our own just made
 * people rate twice. So it's one honest question, "Enjoying Moments together?":
 * - Yes: would you rate us? → the store's own review screen (always opens).
 * - Not really: what would make it better? (saved for us to read), with a quiet
 *   link to rate anyway, so nobody is kept away from the store.
 */
export function RatingPage({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { data: streak } = useStreak();
  const days = Math.max(streak?.current_streak ?? 0, 0);
  const [step, setStep] = useState<Step>('ask');
  const [note, setNote] = useState('');
  // While typing, the page tightens up so the box and Send stay above the keyboard.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setTyping(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setTyping(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const close = () => {
    void trackForCouple('rating_page_closed', { step });
    void markRatingPageDismissed();
    onDone();
  };

  const answer = (enjoying: boolean) => {
    void Haptics.selectionAsync();
    void trackForCouple('rating_submitted', { enjoying });
    setStep(enjoying ? 'rate' : 'feedback');
  };

  /** Off to the store's review screen, once this page has gone (iPhone drops it otherwise). */
  const goRate = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void trackForCouple('rating_store_opened', { from: step });
    void markStoreReviewCompleted();
    onDone();
    setTimeout(() => void openStoreReview(), 450);
  };

  const sendNote = () => {
    const text = note.trim();
    if (!text) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void trackForCouple('feedback_sent', { text: text.slice(0, 2000) });
    void markRatingFeedbackGiven();
    setStep('thanks');
    setTimeout(onDone, 1600);
  };

  const primary = (label: string, onPress: () => void, disabled = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: colors.accent, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
      ]}>
      <Text style={[styles.primaryText, { color: colors.onAccent }]}>{label}</Text>
    </Pressable>
  );
  const secondary = (label: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.secondary, { borderColor: colors.text }, pressed && styles.pressed]}>
      <Text style={[styles.secondaryText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
  const quiet = (label: string, onPress: () => void) => (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={styles.quiet}>
      <Text style={[styles.quietText, { color: colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <ThemedStatusBar />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={close}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.close}>
          <Icon name="close" size={26} color={colors.text} />
        </Pressable>
        {/* Scrolls on small phones and with the keyboard up; a tap outside the box closes the keyboard. */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scroll, { paddingBottom: typing ? 12 : insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>

        {step === 'ask' ? (
          <Animated.View key="ask" entering={FadeIn.duration(220)} style={styles.flex}>
            <View style={styles.middle}>
              <CoupleCharacters width={220} />
              <Text style={[styles.title, { color: colors.text }]}>
                {days >= 3 ? `${days} days in a row together. Enjoying Moments?` : 'Enjoying Moments together?'}
              </Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>Tell us honestly. Either answer helps.</Text>
            </View>
            <View style={styles.actions}>
              {primary('Yes, we love it', () => answer(true))}
              {secondary('Not really', () => answer(false))}
            </View>
          </Animated.View>
        ) : step === 'rate' ? (
          <Animated.View key="rate" entering={FadeIn.duration(220)} style={styles.flex}>
            <View style={styles.middle}>
              <CoupleCharacters width={220} />
              <Text style={[styles.title, { color: colors.text }]}>That makes our day</Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                Would you leave a quick rating on the {STORE_NAME}? It takes a few seconds and helps other couples
                find Moments.
              </Text>
            </View>
            <View style={styles.actions}>
              {primary(`Rate on the ${STORE_NAME}`, goRate)}
              {quiet('Maybe later', close)}
            </View>
          </Animated.View>
        ) : step === 'feedback' ? (
          <Animated.View key="feedback" entering={FadeIn.duration(220)} style={styles.flex}>
            <View style={[styles.middle, typing && styles.middleTyping]}>
              <Text style={[styles.title, { color: colors.text }]}>What would make it better?</Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                We read every note. Tell us what’s missing or what got in the way.
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="What would make Moments better for you two?"
                placeholderTextColor={colors.textTertiary}
                multiline
                scrollEnabled
                maxLength={2000}
                textAlignVertical="top"
                style={[
                  styles.note,
                  typing && styles.noteTyping,
                  { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              />
            </View>
            <View style={styles.actions}>
              {primary('Send feedback', sendNote, !note.trim())}
              {/* The other ways out stay out of the way while typing. */}
              {typing ? null : (
                <View style={styles.quietRow}>
                  {quiet('Email us instead', () => void sendFeedbackByEmail())}
                  <View style={[styles.dot, { backgroundColor: colors.textTertiary }]} />
                  {quiet(`Rate on the ${STORE_NAME}`, goRate)}
                </View>
              )}
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="thanks" entering={FadeIn.duration(220)} style={styles.middle}>
            <CoupleCharacters width={200} />
            <Text style={[styles.title, { color: colors.text }]}>Thank you</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              We read every one. It helps us make Moments better for you two.
            </Text>
          </Animated.View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  flex: { flex: 1 },
  // Fills the screen when there's room (content centred, buttons at the bottom), scrolls when there isn't.
  scroll: { flexGrow: 1 },
  close: { alignSelf: 'flex-end', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 12 },
  // Typing: up under the close button, so the box sits clear of the keyboard.
  middleTyping: { justifyContent: 'flex-start' },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.7, lineHeight: 35, textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
  note: {
    alignSelf: 'stretch',
    minHeight: 120,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    lineHeight: 21,
  },
  noteTyping: { minHeight: 100, maxHeight: 160 },
  actions: { gap: 10, paddingTop: 12 },
  primary: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 17, fontWeight: '800' },
  secondary: { height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 17, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  quiet: { height: 44, alignItems: 'center', justifyContent: 'center' },
  quietText: { fontSize: 15, fontWeight: '700' },
  quietRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  dot: { width: 3, height: 3, borderRadius: 2 },
});
