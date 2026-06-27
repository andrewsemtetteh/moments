import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    StyleSheet,
    Text,
    View,
    type ListRenderItem,
} from 'react-native';

import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { IntroIllustration } from '@/components/onboarding/IntroIllustration';
import { IntroStoryProgress } from '@/components/onboarding/IntroStoryProgress';
import { Icon } from '@/components/ui/Icon';
import { Radius } from '@/constants/design-system';
import { INTRO_SLIDES, type IntroSlide } from '@/constants/intro-slides';
import { useTheme } from '@/hooks/useTheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const H_PADDING = 24;
const SLIDE_WIDTH = SCREEN_WIDTH;
const ILLUSTRATION_HEIGHT = Math.min(SCREEN_HEIGHT * 0.34, 300);

type Props = {
  onComplete: () => void;
  onClose: () => void;
  onSkip: () => void;
};

export function IntroPager({ onComplete, onClose, onSkip }: Props) {
  const { colors } = useTheme();
  const listRef = useRef<FlatList<IntroSlide>>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === INTRO_SLIDES.length - 1;

  const goNext = useCallback(() => {
    if (isLast) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onComplete();
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    void Haptics.selectionAsync();
  }, [index, isLast, onComplete]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / SLIDE_WIDTH);
    setIndex(next);
  };

  const renderItem: ListRenderItem<IntroSlide> = ({ item }) => (
    <View style={[styles.slide, { width: SLIDE_WIDTH }]}>
      <View style={[styles.illustrationWrap, { height: ILLUSTRATION_HEIGHT }]}>
        <IntroIllustration slideId={item.id} icons={item.icons} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>
          {item.title}{' '}
          <Text style={[styles.titleAccent, { color: colors.accent }]}>{item.highlight}</Text>
        </Text>
        <Text style={[styles.body, { color: colors.text }]}>{item.body}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.main}>
        <View style={[styles.topBar, { paddingHorizontal: H_PADDING }]}>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              onClose();
            }}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close intro">
            <Icon name="close" size={22} color={colors.text} />
          </Pressable>
          <IntroStoryProgress total={INTRO_SLIDES.length} index={index} />
        </View>

        <FlatList
          ref={listRef}
          data={INTRO_SLIDES}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          getItemLayout={(_, i) => ({ length: SLIDE_WIDTH, offset: SLIDE_WIDTH * i, index: i })}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />

        <View style={[styles.footer, { paddingHorizontal: H_PADDING }]}>
          <AuthPrimaryButton
            label={isLast ? 'Create your space' : 'Continue'}
            onPress={goNext}
            style={styles.cta}
          />

          <Pressable onPress={onSkip} hitSlop={12} style={styles.loginLink}>
            <Text style={[styles.loginPrompt, { color: colors.text }]}>
              Already have an account?{' '}
              <Text style={[styles.loginAction, { color: colors.accent }]}>Log in</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 12,
  },
  main: {
    gap: 4,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 4,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { flexGrow: 0 },
  listContent: { alignItems: 'flex-start' },
  slide: {
    paddingHorizontal: H_PADDING,
  },
  illustrationWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  copy: { gap: 14, paddingHorizontal: 2 },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.9,
    lineHeight: 38,
  },
  titleAccent: {
    fontWeight: '800',
  },
  body: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '500',
    opacity: 0.88,
    maxWidth: 360,
  },
  footer: {
    paddingTop: 22,
    gap: 14,
  },
  cta: {
    borderRadius: Radius.pill,
  },
  loginLink: { alignItems: 'center', paddingVertical: 2 },
  loginPrompt: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  loginAction: {
    fontWeight: '700',
  },
});
