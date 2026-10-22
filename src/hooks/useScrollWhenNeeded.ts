import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/**
 * Lets a ScrollView scroll (and bounce / stretch) only when its content is taller than the
 * space it has. A page whose text fits stays still; once it doesn't (a small phone, big text,
 * the keyboard taking the space), it scrolls as usual.
 *
 * Spread the result onto the ScrollView: `<ScrollView {...useScrollWhenNeeded()} />`.
 */
export function useScrollWhenNeeded() {
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  // Unknown sizes (first frame): allow scrolling, so nothing is ever stuck out of reach.
  const needed = viewport === 0 || content === 0 || content > viewport + 1;
  return {
    scrollEnabled: needed,
    bounces: needed,
    alwaysBounceVertical: false,
    overScrollMode: needed ? ('auto' as const) : ('never' as const),
    onLayout: (e: LayoutChangeEvent) => setViewport(e.nativeEvent.layout.height),
    onContentSizeChange: (_w: number, h: number) => setContent(h),
  };
}
