import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '@/hooks/useTheme';

const ITEM_H = 44;
const VISIBLE = 5;
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;

export function PlanWheelColumn({
  items,
  value,
  onChange,
  width = 72,
}: {
  items: { value: string | number; label: string }[];
  value: string | number;
  onChange: (value: string | number) => void;
  width?: number;
}) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const index = Math.max(
    0,
    items.findIndex((i) => i.value === value),
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: index * ITEM_H, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [index, items.length]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const next = Math.min(items.length - 1, Math.max(0, Math.round(y / ITEM_H)));
    const item = items[next];
    if (!item) return;
    if (item.value !== value) {
      Haptics.selectionAsync();
      onChange(item.value);
    }
    scrollRef.current?.scrollTo({ y: next * ITEM_H, animated: true });
  };

  return (
    <View style={[styles.col, { width, height: ITEM_H * VISIBLE }]}>
      <View
        pointerEvents="none"
        style={[
          styles.selection,
          {
            top: PAD,
            height: ITEM_H,
            backgroundColor: colors.accentSoft,
            borderColor: colors.border,
          },
        ]}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={onEnd}
        onScrollEndDrag={onEnd}
        contentContainerStyle={{ paddingVertical: PAD }}>
        {items.map((item) => {
          const active = item.value === value;
          return (
            <View key={String(item.value)} style={styles.item}>
              <Text
                style={[
                  styles.itemText,
                  {
                    color: active ? colors.text : colors.textTertiary,
                    fontWeight: active ? '700' : '500',
                    fontSize: active ? 22 : 18,
                  },
                ]}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function useTimeWheelItems() {
  return useMemo(
    () => ({
      hours: Array.from({ length: 12 }, (_, i) => {
        const h = i + 1;
        return { value: h, label: String(h) };
      }),
      minutes: Array.from({ length: 60 }, (_, i) => ({
        value: i,
        label: i < 10 ? `0${i}` : String(i),
      })),
      periods: [
        { value: 'AM' as const, label: 'AM' },
        { value: 'PM' as const, label: 'PM' },
      ],
    }),
    [],
  );
}

const styles = StyleSheet.create({
  col: { overflow: 'hidden' },
  selection: {
    position: 'absolute',
    left: 4,
    right: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 1,
  },
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontVariant: ['tabular-nums'],
  },
});
