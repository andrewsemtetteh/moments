import * as Haptics from '@/lib/haptics';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoupleCharacters } from '@/components/onboarding/Characters';
import { Icon } from '@/components/ui/Icon';
import { useStreak } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import {
  ensureStoreReviewFirstOpen,
  markRatingPageDismissed,
  rateFromPage,
  sendFeedbackFromPage,
  shouldShowRatingPage,
} from '@/lib/store-review';
import { ThemedStatusBar } from '@/components/ui/ThemedStatusBar';
import { trackForCouple } from '@/services/analytics';

/**
 * The rating ask: a full page of our own (not Apple's sheet out of nowhere),
 * shown once they've used Moments on 7 different days, then — if closed —
 * no sooner than 4 days later, and never again once they've rated.
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

const STAR_YELLOW = '#FFC83D';
const STAR_WORDS = ['', 'Not for us', 'Could be better', 'It’s okay', 'Really like it', 'Love it'] as const;

/**
 * The rating page. Pick 1–5 yellow stars:
 * - 4 or 5: "Rate Moments" saves the rating, closes, then asks for the store
 *   review (asking while the page is still closing gets silently dropped on iPhone).
 * - 1 to 3: a box right here for what would make it better; it's saved with the
 *   rating (no mail app needed), with email as a fallback.
 */
export function RatingPage({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { data: streak } = useStreak();
  const days = Math.max(streak?.current_streak ?? 0, 0);
  // Starts at 5 ("Love it"); tap a star to change it.
  const [stars, setStars] = useState(5);
  const [note, setNote] = useState('');
  const [thanks, setThanks] = useState(false);
  const happy = stars >= 4;
  const unhappy = stars > 0 && stars <= 3;

  const close = () => {
    void markRatingPageDismissed();
    onDone();
  };

  const pick = (n: number) => {
    void Haptics.selectionAsync();
    setStars(n);
  };

  const rate = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void trackForCouple('rating_submitted', { stars });
    onDone();
    // After the page has gone, so the store's own prompt isn't dropped.
    setTimeout(() => void rateFromPage(), 600);
  };

  const sendNote = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void trackForCouple('rating_submitted', { stars });
    if (note.trim()) void trackForCouple('feedback_sent', { stars, text: note.trim().slice(0, 2000) });
    void markRatingPageDismissed();
    setThanks(true);
    setTimeout(onDone, 1400);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <ThemedStatusBar />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.root,
          { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 },
        ]}>
        <Pressable
          onPress={close}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.close}>
          <Icon name="close" size={26} color={colors.text} />
        </Pressable>

        {thanks ? (
          <View style={styles.middle}>
            <CoupleCharacters width={200} />
            <Text style={[styles.title, { color: colors.text }]}>Thank you</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              We read every one. It helps us make Moments better for you two.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.middle}>
              {unhappy ? null : <CoupleCharacters width={220} />}
              <Text style={[styles.title, { color: colors.text }]}>
                {days >= 3 ? `${days} days in a row together. That’s something.` : 'Enjoying Moments together?'}
              </Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                If Moments is helping you two feel closer, a quick rating helps other couples find it.
              </Text>
              <View style={styles.stars} accessibilityRole="adjustable" accessibilityLabel={`${stars} out of 5 stars`}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const on = n <= stars;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => pick(n)}
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
                      accessibilityState={{ selected: on }}
                      style={({ pressed }) => [styles.star, pressed && { transform: [{ scale: 0.88 }] }]}>
                      <Icon name="star" size={42} color={on ? STAR_YELLOW : colors.borderStrong} filled={on} />
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.starWord, { color: stars ? colors.text : colors.textTertiary }]}>
                {stars ? STAR_WORDS[stars] : 'Tap a star'}
              </Text>

              {unhappy ? (
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="What would make Moments better for you two?"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  maxLength={2000}
                  textAlignVertical="top"
                  style={[
                    styles.note,
                    { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                />
              ) : null}
            </View>

            <Pressable
              onPress={happy ? rate : sendNote}
              disabled={!stars}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.rate,
                { backgroundColor: colors.accent, opacity: !stars ? 0.4 : pressed ? 0.85 : 1 },
              ]}>
              <Text style={[styles.rateText, { color: colors.onAccent }]}>
                {happy ? 'Rate Moments' : unhappy ? 'Send feedback' : 'Rate Moments'}
              </Text>
            </Pressable>
            <Pressable
              onPress={unhappy ? () => void sendFeedbackFromPage() : close}
              hitSlop={8}
              accessibilityRole="button"
              style={styles.feedback}>
              <Text style={[styles.feedbackText, { color: colors.textSecondary }]}>
                {unhappy ? 'Email us instead' : 'Not now'}
              </Text>
            </Pressable>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  close: { alignSelf: 'flex-end', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.7, lineHeight: 35, textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
  stars: { flexDirection: 'row', gap: 4, marginTop: 4 },
  star: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  starWord: { fontSize: 15, fontWeight: '800', marginTop: -6 },
  note: {
    alignSelf: 'stretch',
    minHeight: 110,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    lineHeight: 21,
  },
  rate: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  rateText: { fontSize: 17, fontWeight: '800' },
  feedback: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  feedbackText: { fontSize: 15, fontWeight: '700' },
});
