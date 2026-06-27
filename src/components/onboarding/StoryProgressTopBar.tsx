import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { IntroStoryProgress } from '@/components/onboarding/IntroStoryProgress';

export const STORY_TOP_BAR_H_PADDING = 24;

type Props = {
  total: number;
  index: number;
  /** When omitted, progress spans the full row width. */
  leading?: ReactNode;
};

export function StoryProgressTopBar({ total, index, leading }: Props) {
  return (
    <View style={styles.topBar}>
      {leading ?? null}
      <IntroStoryProgress total={total} index={index} />
    </View>
  );
}

export const storyTopBarStyles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 28,
    paddingBottom: 16,
    paddingHorizontal: STORY_TOP_BAR_H_PADDING,
  },
  sideBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const styles = storyTopBarStyles;
