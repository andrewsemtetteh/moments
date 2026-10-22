import * as Haptics from '@/lib/haptics';
import { useEffect, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { FadeIn } from 'react-native-reanimated';
import { TextInput } from '@/components/ui/ThemedTextInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoupleCharacters } from '@/components/onboarding/Characters';
import { Icon } from '@/components/ui/Icon';
import { ThemedStatusBar } from '@/components/ui/ThemedStatusBar';
import { useStreak } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import {
  ensureStoreReviewFirstOpen,
  markRatingFeedbackGiven,
  markRatingPageDismissed,
  markStoreReviewCompleted,
  openStoreReview,
  requestInAppReview,
  sendFeedbackByEmail,
  shouldShowRatingPage,
  STORE_NAME,
} from '@/lib/store-review';
import { trackForCouple } from '@/services/analytics';
import { useUIStore } from '@/stores';

/**
 * The rating ask, as a full page of our own: once they've used Moments on 7 different
 * days (again a while after closing it; never once they've gone to rate). Settings ›
 * Rate Moments opens the same page any time.
 *
 * "Not really" leads to feedback only (no store link there, by choice). Google Play's
 * policy forbids steering only happy people to the store, so revisit this if it's flagged.
 */
export function StoreReviewSync() {
  useEffect(() => {
    void ensureStoreReviewFirstOpen();
    const timer = setTimeout(() => {
      void shouldShowRatingPage().then((show) => {
        if (show) useUIStore.setState({ showRatingPage: true });
      });
    }, 4000);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

/**
 * Draws the rating page. Mounted with the app's other overlays at the root: a page
 * opened from a tab screen couldn't show over Settings (which sits on top of the tabs).
 */
export function RatingPageHost() {
  const open = useUIStore((s) => s.showRatingPage);
  if (!open) return null;
  return <RatingPage onDone={() => useUIStore.setState({ showRatingPage: false })} />;
}

type Step = 'ask' | 'rate' | 'feedback' | 'thanks' | 'rated';

const STAR_GOLD = '#FFB627';
const STAR_WORDS = ['', 'Not for us', 'Could be better', 'It’s okay', 'We like it', 'We love it'];

/**
 * "Enjoying Moments together?":
 * - Yes: five stars (all filled to start) on the page. 4 or 5 opens the store's own
 *   rating sheet here in the app (only that sheet can post a rating to the store; the
 *   store page is the fallback); 1 to 3 goes to feedback.
 * - Not really: what would make it better? (saved for us to read, or by email).
 */
export function RatingPage({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { data: streak } = useStreak();
  const days = Math.max(streak?.current_streak ?? 0, 0);
  const [step, setStep] = useState<Step>('ask');
  const [stars, setStars] = useState(5);
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
    void trackForCouple('rating_enjoying', { enjoying });
    setStep(enjoying ? 'rate' : 'feedback');
  };

  const pickStars = (n: number) => {
    void Haptics.selectionAsync();
    setStars(n);
  };

  const submitStars = () => {
    void trackForCouple('rating_submitted', { stars, enjoying: stars >= 4 });
    if (stars >= 4) void goRate();
    else setStep('feedback');
  };

  /**
   * The system's stars sheet, over this page: they rate without leaving Moments. Phones
   * that can't show it go to the store page instead (once this page has gone; iPhone
   * drops it otherwise).
   */
  const goRate = async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void markStoreReviewCompleted();
    if (await requestInAppReview()) {
      void trackForCouple('rating_in_app_requested', { from: step });
      setStep('rated');
      return;
    }
    goStore();
  };

  /** The store's own review page (the fallback, or "Didn't see the stars?"). */
  const goStore = () => {
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
        behavior="padding"
        style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
        <View style={styles.topBar}>
          {/* Back to "Enjoying Moments together?" from the stars or the feedback. */}
          {step === 'rate' || step === 'feedback' ? (
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                setStep('ask');
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.close}>
              <Icon name="chevronLeft" size={28} color={colors.text} />
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
            <Icon name="close" size={26} color={colors.text} />
          </Pressable>
        </View>
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
                  {days >= 3 ? `${days} days in a row. Enjoying Moments?` : 'Enjoying Moments together?'}
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
                <Text style={[styles.title, { color: colors.text }]}>How would you rate us?</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                  It takes a second and helps other couples find Moments.
                </Text>
                <StarRow value={stars} onRate={pickStars} emptyColor={colors.textTertiary} />
                <Text style={[styles.starWord, { color: colors.text }]}>{STAR_WORDS[stars]}</Text>
              </View>
              <View style={styles.actions}>
                {primary('Submit rating', submitStars)}
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
                {typing ? null : quiet('Email us instead', () => void sendFeedbackByEmail())}
              </View>
            </Animated.View>
          ) : step === 'rated' ? (
            <Animated.View key="rated" entering={FadeIn.duration(220)} style={styles.flex}>
              <View style={styles.middle}>
                <CoupleCharacters width={200} />
                <StarRow value={stars} size={30} emptyColor={colors.textTertiary} />
                <Text style={[styles.title, { color: colors.text }]}>Thank you</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                  Every rating helps another couple find Moments.
                </Text>
              </View>
              <View style={styles.actions}>
                {primary('Done', onDone)}
                {/* The system decides whether its sheet shows; the store page always works. */}
                {quiet(`Rate on the ${STORE_NAME}`, goStore)}
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

/** Five stars: tap one to rate (or just show a rating when there's no onRate). */
function StarRow({
  value,
  onRate,
  size = 46,
  emptyColor,
}: {
  value: number;
  onRate?: (n: number) => void;
  size?: number;
  emptyColor: string;
}) {
  return (
    <View style={styles.stars} accessibilityRole={onRate ? 'adjustable' : undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={!onRate}
          onPress={() => onRate?.(n)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
          style={({ pressed }) => pressed && styles.pressed}>
          <Icon name="star" filled={n <= value} size={size} color={n <= value ? STAR_GOLD : emptyColor} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 6 },
  starWord: { fontSize: 16, fontWeight: '800', marginTop: -4 },
  root: { flex: 1, paddingHorizontal: 24 },
  flex: { flex: 1 },
  // Fills the screen when there's room (content centred, buttons at the bottom), scrolls when there isn't.
  scroll: { flexGrow: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
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
});
