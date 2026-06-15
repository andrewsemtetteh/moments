import { Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon.web';
import { ExternalLink } from '@/components/external-link';
import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            Moments
          </ThemedText>
        </ThemedView>

        <ThemedText type="code" style={styles.code}>
          your private space for two
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          <HintRow
            title="Share moments"
            hint="Capture photos, mood, and memories together — just the two of you"
          />
          <HintRow
            title="Stay connected"
            hint="Real-time chat, shared calendar, and activities when you need ideas"
          />
          <HintRow
            title="Get the app"
            hint={
              <ThemedText type="small" themeColor="textSecondary">
                Download on{' '}
                <ExternalLink href="https://apps.apple.com">
                  <ThemedText type="linkPrimary">App Store</ThemedText>
                </ExternalLink>
                {' · '}
                <ExternalLink href="https://play.google.com/store">
                  <ThemedText type="linkPrimary">Google Play</ThemedText>
                </ExternalLink>
              </ThemedText>
            }
          />
        </ThemedView>

        {Platform.OS === 'web' && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
            Not social media. A relationship system built for two people.
          </ThemedText>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  code: {
    textTransform: 'uppercase',
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
  footer: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
});
