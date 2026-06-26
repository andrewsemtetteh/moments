import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { WelcomeBackdrop } from '@/components/onboarding/WelcomeBackdrop';
import { Avatar, PrimaryButton } from '@/components/ui/primitives';
import { Radius } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore, useRelationshipStore } from '@/stores';

export default function PartnerWelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const user = useAuthStore((s) => s.user);

  const handleEnter = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)/home');
  };

  return (
    <WelcomeBackdrop vivid>
      <SafeAreaView style={styles.safe}>
        <Animated.View entering={FadeInDown.duration(480).springify()} style={styles.hero}>
          <View style={styles.avatarRow}>
            <Avatar name={user?.name} imageUrl={user?.avatar_url} size={72} />
            <View style={[styles.linkHeart, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
              <Text style={styles.heartEmoji}>💕</Text>
            </View>
            <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={72} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(480).springify()} style={styles.copy}>
          <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>You're connected</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            Welcome to{'\n'}
            {relationship?.relationship_name ?? 'Moments'}
          </Text>
          {partner ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              You and {partner.name} share this space now. Every moment starts with a small hello.
            </Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(480).springify()} style={styles.cardWrap}>
          <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Your first step</Text>
            <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
              Send a moment or message to start your streak and make this home truly yours.
            </Text>
          </View>

          <PrimaryButton label="Enter our space" onPress={handleEnter} style={styles.cta} />
        </Animated.View>
      </SafeAreaView>
    </WelcomeBackdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 24 },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  linkHeart: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 4,
  },
  heartEmoji: { fontSize: 20 },
  copy: { alignItems: 'center', gap: 10, paddingBottom: 24 },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 4,
  },
  cardWrap: { paddingBottom: 20, gap: 18 },
  card: {
    padding: 20,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardBody: { fontSize: 15, lineHeight: 22 },
  cta: { borderRadius: Radius.pill },
});
