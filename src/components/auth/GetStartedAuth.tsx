import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthFooter } from '@/components/auth/AuthFooter';
import { AuthLegalLinks } from '@/components/auth/AuthLegalLinks';
import { AppleIcon, GoogleIcon } from '@/components/auth/OAuthBrandIcon';
import { SwipeDismissView } from '@/components/layout/SwipeDismissView';
import { Icon } from '@/components/ui/Icon';
import { LogoMark } from '@/components/ui/Logo';
import { Radius, Spacing } from '@/constants/design-system';
import { hydrateAuthSession } from '@/lib/auth-session';
import { markIntroCompleted } from '@/lib/intro-storage';
import { signInWithApple, signInWithGoogle } from '@/lib/oauth';
import { goBackOrReplace } from '@/lib/router';
import { supabase } from '@/lib/supabase';

type Props = {
  showBack?: boolean;
};

export function GetStartedAuth({ showBack = true }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loadingProvider, setLoadingProvider] = useState<'apple' | 'google' | null>(null);
  const showApple = Platform.OS === 'ios' || Platform.OS === 'android';
  const busy = loadingProvider !== null;

  const finishOAuth = async () => {
    await markIntroCompleted();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      await hydrateAuthSession(session);
      router.replace('/');
    }
  };

  const handleApple = async () => {
    setLoadingProvider('apple');
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const signedIn = await signInWithApple();
      if (signedIn) await finishOAuth();
    } catch (e: unknown) {
      Alert.alert('Apple sign in failed', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleGoogle = async () => {
    setLoadingProvider('google');
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const signedIn = await signInWithGoogle();
      if (signedIn) await finishOAuth();
    } catch (e: unknown) {
      Alert.alert('Google sign in failed', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleEmail = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await markIntroCompleted();
    router.push('/(auth)/signup');
  };

  const handleBack = () => goBackOrReplace(router, '/(auth)/welcome');

  return (
    <SwipeDismissView onDismiss={handleBack} enabled={showBack && !busy}>
      <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        {showBack ? (
          <View style={[styles.topBar, { paddingTop: insets.top + Spacing.lg + Spacing.sm }]}>
            <Pressable
              onPress={handleBack}
              hitSlop={8}
              style={styles.backBtn}
              accessibilityLabel="Go back">
              <Icon name="chevronLeft" size={22} color="rgba(255,255,255,0.9)" />
            </Pressable>
          </View>
        ) : (
          <View style={{ height: insets.top + Spacing.lg + Spacing.sm }} />
        )}

        <View style={styles.content}>
          <View style={styles.brandBlock}>
            <LogoMark size={88} />
            <Text style={styles.brandName}>Moments</Text>
            <Text style={styles.tagline}>Closer, every day</Text>
          </View>

          <View style={styles.actions}>
            {showApple && (
              <OutlineAuthButton
                label="Continue with Apple"
                icon={<AppleIcon size={20} color="#FFFFFF" />}
                onPress={handleApple}
                loading={loadingProvider === 'apple'}
                disabled={busy}
              />
            )}

            <OutlineAuthButton
              label="Continue with Google"
              icon={<GoogleIcon size={18} />}
              onPress={handleGoogle}
              loading={loadingProvider === 'google'}
              disabled={busy}
            />

            <Text style={styles.or}>or</Text>

            <Pressable
              onPress={handleEmail}
              disabled={busy}
              style={({ pressed }) => [styles.emailBtn, { opacity: pressed || busy ? 0.9 : 1 }]}>
              <Ionicons name="mail-outline" size={18} color="#000000" style={styles.emailIcon} />
              <Text style={styles.emailBtnText}>Continue with Email</Text>
            </Pressable>
          </View>

          <AuthFooter
            prompt="Already have an account?"
            linkLabel="Log in"
            href="/(auth)/login"
            onBeforeNavigate={markIntroCompleted}
          />

          <AuthLegalLinks
            prefix="By continuing you agree to our"
            style={styles.legalNotice}
          />
        </View>
      </SafeAreaView>
      </View>
    </SwipeDismissView>
  );
}

function OutlineAuthButton({
  label,
  icon,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.outlineBtn, { opacity: pressed || (disabled && !loading) ? 0.82 : 1 }]}>
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <View style={styles.outlineContent}>
          {icon}
          <Text style={styles.outlineBtnText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  safe: { flex: 1 },
  topBar: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    paddingBottom: Spacing.md,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brandName: {
    marginTop: 20,
    fontSize: 36,
    fontWeight: '400',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  },
  tagline: {
    marginTop: 8,
    fontSize: 15,
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
  },
  actions: {
    gap: 12,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  outlineBtn: {
    minHeight: 54,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  outlineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  outlineBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  or: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.72)',
    fontSize: 15,
    fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    marginVertical: 4,
  },
  emailBtn: {
    minHeight: 54,
    borderRadius: Radius.pill,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  emailIcon: { opacity: 0.55 },
  emailBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  legalNotice: {
    marginTop: 16,
    paddingHorizontal: 8,
  },
});
