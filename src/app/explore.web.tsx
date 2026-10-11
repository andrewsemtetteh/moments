import { LinearGradient } from 'expo-linear-gradient';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { FeatureCard } from '@/components/feature-card';
import { Icon } from '@/components/ui/Icon';
import { StoreBadges } from '@/components/store-badges';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebFooter } from '@/components/web-footer';
import { MaxContentWidth, Radius, Spacing, TextContentWidth, WebNavClearance } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWebViewportWidth } from '@/hooks/use-web-viewport-width';

export default function FeaturesScreen() {
  const theme = useTheme();
  const width = useWebViewportWidth();
  const isNarrow = width < 760;

  return (
    <ThemedView style={styles.page}>
      <LinearGradient colors={theme.gradient} style={StyleSheet.absoluteFill} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.shell}>
          <View style={styles.main}>
            <View style={styles.titleBlock}>
              <ThemedText type="eyebrow" themeColor="accent">
                What is inside
              </ThemedText>
              <ThemedText type="display" style={[styles.title, isNarrow && styles.titleNarrow]}>
                Everything lives in one shared space
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary" style={styles.centerText}>
                Moments is not a social network. Every feature below exists inside a private
                relationship space made for exactly two people.
              </ThemedText>
            </View>

            <View style={styles.grid}>
              <FeatureCard
                icon="camera"
                tint="accent"
                title="Moments and memories"
                body="Share photo and video moments with your partner on a private memory wall. Your relationship history stays between the two of you, never a public feed."
              />
              <FeatureCard
                icon="messages"
                tint="accentSecondary"
                title="Real-time chat"
                body="One private conversation per relationship. Messages sync instantly with read receipts, media sharing, and offline support when you are apart."
              />
              <FeatureCard
                icon="dice"
                tint="spark"
                title="Activities together"
                body="Daily challenges, conversation cards, date ideas, and an AI activity generator for when you are bored. Built to help you do things together, not scroll alone."
              />
              <FeatureCard
                icon="calendar"
                tint="accent"
                title="Calendar and planning"
                body="Shared date nights, anniversaries, and reminders. Both partners see the same plan and get notified when something is coming up."
              />
              <FeatureCard
                icon="heart"
                tint="accentSecondary"
                title="Mood check-ins"
                body="Check in on how you feel and see a mood snapshot of you and your partner right on the home screen."
              />
              <FeatureCard
                icon="lock"
                tint="spark"
                title="Privacy first"
                body="Every feature is scoped to your relationship, with data isolation by design."
              />
            </View>

            <View style={styles.privacyBanner}>
              <View style={[styles.privacyIcon, { backgroundColor: theme.backgroundElement }]}>
                <Icon name="lock" size={24} color={theme.accent} />
              </View>
              <ThemedText type="subtitle" style={styles.privacyTitle}>
                Built for two, never for a crowd
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary" style={styles.centerText}>
                There is no public profile, no search, and no algorithm deciding what you see.
                Everything you share stays inside your relationship, period.
              </ThemedText>
            </View>

            <View style={styles.ctaBlock}>
              <ThemedText type="subtitle" style={styles.ctaTitle}>
                Get Moments
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary" style={styles.centerText}>
                Available on iOS and Android now.
              </ThemedText>
              <StoreBadges style={styles.badges} />
            </View>

            {Platform.OS === 'web' && (
              <ThemedText type="small" themeColor="textTertiary" style={styles.tagline}>
                This page is for information only. Create your space inside the mobile app.
              </ThemedText>
            )}
          </View>

          {Platform.OS === 'web' && <WebFooter />}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: Spacing.six,
  },
  shell: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: WebNavClearance,
    alignItems: 'center',
  },
  main: {
    width: '100%',
    alignItems: 'center',
  },
  titleBlock: {
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: TextContentWidth,
    paddingBottom: Spacing.five,
  },
  title: {
    textAlign: 'center',
  },
  titleNarrow: {
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.6,
  },
  centerText: {
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'center',
    width: '100%',
  },
  privacyBanner: {
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: TextContentWidth,
    marginTop: Spacing.six,
  },
  privacyIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  privacyTitle: {
    textAlign: 'center',
  },
  ctaBlock: {
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.six,
  },
  ctaTitle: {
    textAlign: 'center',
  },
  badges: {
    marginTop: Spacing.two,
  },
  tagline: {
    textAlign: 'center',
    marginTop: Spacing.four,
  },
});
