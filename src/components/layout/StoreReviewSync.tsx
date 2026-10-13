import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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

function RatingPage({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { data: streak } = useStreak();
  const days = Math.max(streak?.current_streak ?? 0, 0);

  const close = () => {
    void markRatingPageDismissed();
    onDone();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 18 }]}>
        <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
          <Icon name="close" size={26} color={colors.text} />
        </Pressable>

        <View style={styles.middle}>
          <CoupleCharacters width={220} />
          <Text style={[styles.title, { color: colors.text }]}>
            {days >= 3 ? `${days} days in a row together. That’s something.` : 'Enjoying Moments together?'}
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            If Moments is helping you two feel closer, a quick rating helps other couples find it.
          </Text>
          <View style={styles.stars}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Icon key={i} name="star" size={34} color={colors.text} filled />
            ))}
          </View>
        </View>

        <Pressable
          onPress={() => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            void rateFromPage();
            onDone();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.rate, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}>
          <Text style={[styles.rateText, { color: colors.onAccent }]}>Rate Moments</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void sendFeedbackFromPage();
            onDone();
          }}
          hitSlop={8}
          accessibilityRole="button"
          style={styles.feedback}>
          <Text style={[styles.feedbackText, { color: colors.textSecondary }]}>Send feedback instead</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  close: { alignSelf: 'flex-end', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.7, lineHeight: 35, textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
  stars: { flexDirection: 'row', gap: 8, marginTop: 4 },
  rate: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  rateText: { fontSize: 17, fontWeight: '800' },
  feedback: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  feedbackText: { fontSize: 15, fontWeight: '700' },
});
