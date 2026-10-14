import { useEffect, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export type TourRect = { x: number; y: number; width: number; height: number };

/** What the tour can point at, by name. */
const targets = new Map<string, View>();

/** Where a target is on screen right now (null if it isn't mounted or measured). */
export function measureTourTarget(key: string): Promise<TourRect | null> {
  const view = targets.get(key);
  if (!view) return Promise.resolve(null);
  return new Promise((resolve) => {
    view.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

/**
 * Wrap a part of the UI the tour explains, so it can spotlight exactly that.
 * Renders nothing extra: just a plain View the tour measures.
 */
export function TourTarget({
  name,
  style,
  children,
}: {
  name: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const ref = useRef<View>(null);
  useEffect(() => {
    const view = ref.current;
    if (view) targets.set(name, view);
    return () => {
      if (targets.get(name) === view) targets.delete(name);
    };
  }, [name]);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}
