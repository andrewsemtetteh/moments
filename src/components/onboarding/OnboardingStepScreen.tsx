import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOut, LinearTransition, runOnJS } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { prevStep as stepBefore, stepProgress, stepRoute, type OnboardingStep } from '@/lib/onboarding-v2';
import { trackColor, primaryButtonEdge } from '@/components/ui/primitives';

function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

/** Same gap above the button as below it (to the keyboard, or the home bar). */
const FOOTER_GAP = 14;

/**
 * One onboarding step: back arrow and progress at the top, the content, and
 * the main button pinned at the bottom (plus an optional quiet second link,
 * e.g. "Skip" or "Not now"). Tapping empty space closes the keyboard.
 */
export function OnboardingStepScreen({
  step,
  title,
  subtitle,
  art,
  centered = false,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  busy = false,
  secondaryLabel,
  secondaryAction,
  onSecondary,
  footerNote,
  onBack,
  scroll = true,
  fill = false,
  scrollHint,
  children,
}: {
  /** A floating "more below" pill (e.g. "Scroll for more themes") while there's more to see. */
  scrollHint?: string;
  /** Off for screens with their own scroller (the date wheel), so the two don't fight. */
  scroll?: boolean;
  /** One screen, no scrolling: the content stretches to fill what's left above the buttons. */
  fill?: boolean;
  /** The onboarding step (draws the progress bar). Account screens leave it out. */
  step?: OnboardingStep;
  title: string;
  subtitle?: string;
  /** Illustration above the title. */
  art?: ReactNode;
  centered?: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  busy?: boolean;
  secondaryLabel?: string;
  /** The tappable word(s) after the label, as on Welcome: "I already have an account **Sign in**". */
  secondaryAction?: string;
  onSecondary?: () => void;
  footerNote?: string;
  /** Defaults to going back a screen; pass null to hide the arrow. */
  onBack?: (() => void) | null;
  children?: ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const preview = useLocalSearchParams<{ preview?: string }>().preview === '1';
  // Back: the previous screen. When this screen was opened fresh (the app
  // resumed mid-onboarding, so there's no history), go to the previous step.
  const prevStep = step ? stepBefore(step) : undefined;
  const defaultBack =
    router.canGoBack() || prevStep
      ? () => {
          if (router.canGoBack()) router.back();
          else if (prevStep) router.replace(stepRoute(prevStep, preview));
        }
      : null;
  const back = onBack === undefined ? defaultBack : onBack;
  const progress = step ? stepProgress(step) : null;
  const keyboardOpen = useKeyboardOpen();
  const scrollRef = useRef<ScrollView>(null);
  // The "more below" pill: shown while the content runs past the screen, gone once they scroll.
  const [viewH, setViewH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  // Still when everything fits; scrolls once it doesn't (or the keyboard takes the room).
  const needsScroll = viewH === 0 || contentH === 0 || contentH > viewH + 1;
  const showHint = !!scrollHint && !scrolled && !keyboardOpen && contentH > viewH + 24 && viewH > 0;

  // When the keyboard opens, bring the fields (they sit at the end) into view.
  useEffect(() => {
    if (!keyboardOpen) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(t);
  }, [keyboardOpen]);

  // Swipe right anywhere to go back (a clearly sideways drag, so scrolling
  // and typing still work).
  const swipeBack = Gesture.Pan()
    .enabled(!!back)
    .activeOffsetX(20)
    .failOffsetX(-12)
    .failOffsetY([-16, 16])
    .onEnd((e) => {
      if ((e.translationX > 80 || e.velocityX > 650) && back) runOnJS(back)();
    });

  return (
    <GestureDetector gesture={swipeBack}>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <View style={styles.flex}>
            {/* No back arrow (first step): the bar spans evenly instead. With nothing to show
                (no arrow, no progress), there's no bar at all: an empty one read as a header
                the page slid under. */}
            {back || progress != null ? (
            <Pressable onPress={Keyboard.dismiss} accessible={false} style={[styles.top, !back && styles.topNoBack]}>
              {back ? (
                <Pressable onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
                  <Icon name="chevronLeft" size={28} color={colors.text} />
                </Pressable>
              ) : null}
              {progress != null ? (
                <View style={[styles.track, !back && styles.trackNoBack, { backgroundColor: trackColor(colors) }]}>
                  <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.accent }]} />
                </View>
              ) : null}
            </Pressable>
            ) : (
              <View style={styles.topSpacer} />
            )}

            <View style={styles.flex}>
            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
              onContentSizeChange={(_, h) => setContentH(h)}
              onScroll={(e) => {
                if (!scrolled && e.nativeEvent.contentOffset.y > 40) setScrolled(true);
              }}
              scrollEventThrottle={64}
              scrollEnabled={scroll && !fill && needsScroll}
              bounces={needsScroll}
              alwaysBounceVertical={false}
              overScrollMode={needsScroll ? 'auto' : 'never'}
              // Taps on empty space close the keyboard; fields and buttons still work.
              keyboardDismissMode="interactive"
              // While typing, everything moves up under the header (centring
              // would leave the fields behind the keyboard).
              contentContainerStyle={[styles.body, centered && !keyboardOpen && styles.bodyCentered, fill && styles.bodyFill]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {art && !keyboardOpen ? (
                <Animated.View entering={FadeInDown.duration(420)} exiting={FadeOut.duration(150)} style={styles.art}>
                  {/* Still: the characters bring their own life (eyes, hearts). */}
                  {art}
                </Animated.View>
              ) : null}
              <Animated.Text
                entering={FadeInDown.delay(60).duration(380)}
                layout={LinearTransition.duration(220)}
                style={[styles.title, { color: colors.text }, (centered || !!art) && styles.textCenter]}>
                {title}
              </Animated.Text>
              {subtitle ? (
                <Animated.Text
                  entering={FadeInDown.delay(110).duration(380)}
                  layout={LinearTransition.duration(220)}
                  style={[styles.subtitle, { color: colors.textSecondary }, (centered || !!art) && styles.textCenter]}>
                  {subtitle}
                </Animated.Text>
              ) : null}
              <Animated.View
                entering={FadeInDown.delay(160).duration(420)}
                layout={LinearTransition.duration(220)}
                style={[styles.content, fill && styles.flex]}>
                {children}
              </Animated.View>
            </ScrollView>
              {showHint ? (
                <Animated.View
                  entering={FadeInDown.delay(700).duration(360)}
                  exiting={FadeOut.duration(180)}
                  pointerEvents="box-none"
                  style={styles.hintWrap}>
                  <Pressable
                    onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.hint,
                      { backgroundColor: colors.text },
                      pressed && { opacity: 0.85 },
                    ]}>
                    <Text style={[styles.hintText, { color: colors.background }]}>{scrollHint}</Text>
                    <Icon name="chevronDown" size={16} color={colors.background} />
                  </Pressable>
                </Animated.View>
              ) : null}
            </View>

            <View style={[styles.footer, { paddingBottom: keyboardOpen ? FOOTER_GAP : insets.bottom + FOOTER_GAP }]}>
              <Pressable
                onPress={onPrimary}
                disabled={primaryDisabled || busy}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: colors.accent, opacity: primaryDisabled ? 0.4 : pressed ? 0.85 : 1 },
                  primaryButtonEdge(colors),
                ]}>
                {busy ? (
                  <ActivityIndicator color={colors.onAccent} />
                ) : (
                  <Text style={[styles.primaryText, { color: colors.onAccent }]}>{primaryLabel}</Text>
                )}
              </Pressable>
              {secondaryLabel && onSecondary && !keyboardOpen ? (
                <Pressable onPress={onSecondary} disabled={busy} hitSlop={6} accessibilityRole="button" style={styles.secondary}>
                  <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>
                    {secondaryLabel}
                    {secondaryAction ? (
                      <>
                        {' '}
                        <Text style={[styles.secondaryAction, { color: colors.text }]}>{secondaryAction}</Text>
                      </>
                    ) : null}
                  </Text>
                </Pressable>
              ) : null}
              {footerNote && !keyboardOpen ? <Text style={[styles.note, { color: colors.textTertiary }]}>{footerNote}</Text> : null}
            </View>
          </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topNoBack: { paddingHorizontal: 24, minHeight: 58 },
  topSpacer: { height: 8 },
  trackNoBack: { marginRight: 0 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', marginRight: 10 },
  fill: { height: '100%', borderRadius: 3 },
  body: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 24, gap: 10 },
  bodyCentered: { flexGrow: 1, justifyContent: 'center' },
  bodyFill: { flexGrow: 1 },
  art: { alignItems: 'center', marginBottom: 6 },
  hintWrap: { position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center' },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  hintText: { fontSize: 14, fontWeight: '800' },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.7, lineHeight: 34 },
  subtitle: { fontSize: 16, lineHeight: 22 },
  textCenter: { textAlign: 'center' },
  content: { marginTop: 12, gap: 12 },
  footer: { paddingHorizontal: 24, paddingTop: FOOTER_GAP, gap: 4, alignItems: 'stretch' },
  primary: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 17, fontWeight: '800' },
  secondary: { height: 40, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '600' },
  // The same link as on Welcome and Create account.
  secondaryAction: { fontWeight: '800', textDecorationLine: 'underline' },
  note: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
});
