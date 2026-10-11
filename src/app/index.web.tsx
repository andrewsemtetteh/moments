import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AnimatedIcon } from '@/components/animated-icon.web';
import { FeatureCard } from '@/components/feature-card';
import { StoreBadges } from '@/components/store-badges';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebFooter } from '@/components/web-footer';
import { MaxContentWidth, Radius, Spacing, TextContentWidth, WebNavClearance } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWebViewportWidth } from '@/hooks/use-web-viewport-width';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const width = useWebViewportWidth();
  const isNarrow = width < 760;

  return (
    <ThemedView style={styles.page}>
      <LinearGradient colors={theme.gradient} style={StyleSheet.absoluteFill} />
      <View
        pointerEvents="none"
        style={[styles.blob, { top: -80, right: -60, backgroundColor: theme.spark }]}
      />
      <View
        pointerEvents="none"
        style={[styles.blob, { bottom: -100, left: -80, backgroundColor: theme.accentSecondary }]}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.shell}>
          <View style={styles.main}>
            <View style={styles.hero}>
              <AnimatedIcon />
              <ThemedText type="eyebrow" themeColor="accent" style={styles.eyebrow}>
                Private, just the two of you
              </ThemedText>
              <ThemedText
                type="display"
                style={[styles.headline, isNarrow && styles.headlineNarrow]}>
                A relationship space built for two
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary" style={styles.subhead}>
                Moments keeps your photos, chats, plans, and check-ins in one calm place made
                only for the two of you. No feed, no followers, no strangers.
              </ThemedText>
              <StoreBadges style={styles.badges} />
            </View>

            <View style={[styles.previewGrid, isNarrow && styles.previewGridNarrow]}>
              <FeatureCard
                icon="camera"
                tint="accent"
                title="Share moments"
                body="Capture photos and mood together, just the two of you, saved to a private wall."
              />
              <FeatureCard
                icon="messages"
                tint="accentSecondary"
                title="Stay connected"
                body="One private chat that syncs in real-time, wherever either of you is."
              />
              <FeatureCard
                icon="calendar"
                tint="spark"
                title="Plan together"
                body="A shared calendar, date ideas, and reminders that both of you see."
              />
            </View>

            <Pressable
              onPress={() => router.push('/explore')}
              style={({ pressed }) => [styles.moreLink, pressed && styles.pressed]}>
              <ThemedText type="linkPrimary" themeColor="accent" style={styles.moreLinkText}>
                See everything Moments does
              </ThemedText>
            </Pressable>

            {Platform.OS === 'web' && (
              <ThemedText type="small" themeColor="textTertiary" style={styles.tagline}>
                Not social media. A relationship system built for two people.
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
  blob: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 420,
    opacity: 0.14,
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
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: TextContentWidth,
    paddingBottom: Spacing.six,
  },
  eyebrow: {
    marginTop: Spacing.three,
  },
  headline: {
    textAlign: 'center',
  },
  headlineNarrow: {
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.6,
  },
  subhead: {
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  badges: {
    marginTop: Spacing.four,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'center',
    width: '100%',
  },
  previewGridNarrow: {
    flexDirection: 'column',
  },
  moreLink: {
    marginTop: Spacing.five,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
  },
  pressed: {
    opacity: 0.7,
  },
  moreLinkText: {
    fontSize: 16,
    fontWeight: '700',
  },
  tagline: {
    textAlign: 'center',
    marginTop: Spacing.four,
  },
});
