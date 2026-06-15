import { Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function FeaturesScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={styles.contentContainer}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="subtitle">Features</ThemedText>
          <ThemedText style={styles.centerText} themeColor="textSecondary">
            Everything in Moments exists inside a private{'\n'}relationship space for two people.
          </ThemedText>

          <ExternalLink href="https://apps.apple.com" asChild>
            <Pressable style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.linkButton}>
                <ThemedText type="link">Download Moments</ThemedText>
              </ThemedView>
            </Pressable>
          </ExternalLink>
        </ThemedView>

        <ThemedView style={styles.sectionsWrapper}>
          <Collapsible title="Moments & memories">
            <ThemedText type="small">
              Share photo and video moments with your partner on a private memory wall.
              Your relationship history stays between the two of you — never a public feed.
            </ThemedText>
          </Collapsible>

          <Collapsible title="Real-time chat">
            <ThemedText type="small">
              One private conversation per relationship. Messages sync in real time with read receipts,
              media sharing, and offline support when you are apart.
            </ThemedText>
          </Collapsible>

          <Collapsible title="Activities together">
            <ThemedText type="small">
              Daily challenges, conversation cards, date ideas, and an AI activity generator for
              when you are bored. Built to help you do things together, not scroll alone.
            </ThemedText>
          </Collapsible>

          <Collapsible title="Calendar & planning">
            <ThemedText type="small">
              Shared date nights, anniversaries, and reminders — both partners see the same plan
              and get notified when something is coming up.
            </ThemedText>
          </Collapsible>

          <Collapsible title="Journal & mood">
            <ThemedText type="small">
              Check in on how you feel, write shared journal entries, and see a mood snapshot of
              you and your partner on the home screen.
            </ThemedText>
          </Collapsible>

          <Collapsible title="Privacy first">
            <ThemedText type="small">
              No ads, no followers, no discovery. Every feature is scoped to your{' '}
              <ThemedText type="code">relationship_id</ThemedText> — data isolation by design.
            </ThemedText>
            <ExternalLink href="https://apps.apple.com">
              <ThemedText type="linkPrimary">Get the app</ThemedText>
            </ExternalLink>
          </Collapsible>
        </ThemedView>

        {Platform.OS === 'web' && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
            Available on iOS and Android. Web is for info only — sign up in the mobile app.
          </ThemedText>
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: Spacing.six,
    paddingBottom: Spacing.four,
  },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
  },
  titleContainer: {
    gap: Spacing.three,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  centerText: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  linkButton: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    justifyContent: 'center',
    gap: Spacing.one,
    alignItems: 'center',
  },
  sectionsWrapper: {
    gap: Spacing.five,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  footer: {
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
  },
});
