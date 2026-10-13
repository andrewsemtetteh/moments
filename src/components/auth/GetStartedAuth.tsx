import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInDown, runOnJS } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthChoiceButton } from '@/components/auth/AuthChoiceButton';
import { AuthLegalLinks } from '@/components/auth/AuthLegalLinks';
import { AppleIcon, GoogleIcon } from '@/components/auth/OAuthBrandIcon';
import { useSocialSignIn, type SocialProvider } from '@/components/auth/useSocialSignIn';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { markIntroCompleted } from '@/lib/intro-storage';
import { designPass } from '@/lib/onboarding-v2';
import { goBackOrReplace } from '@/lib/router';

type Props = {
  showBack?: boolean;
};

/**
 * Create your account, in the onboarding style: back arrow, a centred
 * title, then Apple (the ink pill), Google and email (outlined), a privacy note and
 * the terms. Apple/Google go straight on to the name step; email goes to the
 * email + password page.
 */
export function GetStartedAuth({ showBack = true }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const showApple = Platform.OS === 'ios' || Platform.OS === 'android';
  const social = useSocialSignIn({ onSuccess: () => router.replace('/'), beforeStart: markIntroCompleted });

  const startSocial = (provider: SocialProvider) => {
    if (__DEV__ && designPass.on) {
      // Replace, like the email route: there's no going back to sign-up.
      router.replace({ pathname: '/(onboarding)/about-you', params: { preview: '1' } });
      return;
    }
    void social.start(provider);
  };

  const handleEmail = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await markIntroCompleted();
    router.push('/(auth)/signup-email');
  };

  const goSignIn = async () => {
    await markIntroCompleted();
    // Swap rather than stack, so switching between the two never piles up screens.
    router.replace('/(auth)/login');
  };

  const back = () => goBackOrReplace(router, '/(auth)/welcome');

  // Swipe right anywhere to go back, like the onboarding steps.
  const swipeBack = Gesture.Pan()
    .enabled(showBack)
    .activeOffsetX(20)
    .failOffsetX(-12)
    .failOffsetY([-16, 16])
    .onEnd((e) => {
      if (e.translationX > 80 || e.velocityX > 650) runOnJS(back)();
    });

  return (
    <GestureDetector gesture={swipeBack}>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <StatusBar style={colors.isDark ? 'light' : 'dark'} />
        <View style={styles.top}>
          {showBack ? (
            <Pressable onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
              <Icon name="chevronLeft" size={28} color={colors.text} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          bounces={false}>
          {/* Equal space above and below: the logo, title and buttons sit centred. */}
          <View style={styles.flex} />
          <Animated.View entering={FadeInDown.duration(380)} style={styles.head}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
              Create your account
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>It takes ten seconds.</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.actions}>
            {showApple ? (
              <AuthChoiceButton
                variant="filled"
                label="Continue with Apple"
                icon={<AppleIcon size={20} color={colors.background} />}
                onPress={() => startSocial('apple')}
                loading={social.loadingProvider === 'apple'}
                disabled={social.busy}
              />
            ) : null}
            <AuthChoiceButton
              label="Continue with Google"
              icon={<GoogleIcon size={18} />}
              onPress={() => startSocial('google')}
              loading={social.loadingProvider === 'google'}
              disabled={social.busy}
            />
            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.orText, { color: colors.textTertiary }]}>or</Text>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
            </View>
            <AuthChoiceButton
              label="Continue with email"
              icon={<Icon name="mail" size={20} color={colors.text} />}
              onPress={() => void handleEmail()}
              disabled={social.busy}
            />
            <Pressable onPress={() => void goSignIn()} hitSlop={8} accessibilityRole="link" style={styles.switchRow}>
              <Text style={[styles.switchText, { color: colors.textSecondary }]}>
                Already have an account? <Text style={[styles.switchLink, { color: colors.text }]}>Sign in</Text>
              </Text>
            </Pressable>
          </Animated.View>

          <View style={styles.flex} />

          <View style={[styles.privacy, { borderColor: colors.text }]}>
            <Icon name="lock" size={22} color={colors.text} />
            <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
              Private by design. Only the two of you ever see what you share.
            </Text>
          </View>
          <AuthLegalLinks prefix="By continuing you agree to our" style={styles.legal} />
        </ScrollView>
      </SafeAreaView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  top: { minHeight: 56, paddingHorizontal: 14, paddingTop: 6, justifyContent: 'center' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 6, gap: 22 },
  head: { gap: 10, alignItems: 'center' },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.7, lineHeight: 34, marginTop: 6, textAlign: 'center' },
  subtitle: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
  actions: { gap: 12, marginTop: 4 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  orText: { fontSize: 13, fontWeight: '800' },
  switchRow: { alignItems: 'center', paddingVertical: 6 },
  switchText: { fontSize: 15 },
  switchLink: { fontWeight: '800', textDecorationLine: 'underline' },
  privacy: { borderWidth: 2, borderRadius: 20, padding: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  privacyText: { flex: 1, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  legal: { marginTop: -6 },
});
