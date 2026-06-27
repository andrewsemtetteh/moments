import { format, getDaysInMonth } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { colorWithAlpha } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { formatAnniversaryForDb, parseAnniversaryDate } from '@/lib/anniversary';

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const WHEEL_PAD = ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2);
const COLUMN_GAP = 10;
const FLICK_VELOCITY_THRESHOLD = 0.15;
const MAX_FLICK_ROWS = 3;

const MONTHS = Array.from({ length: 12 }, (_, month) => month);
const MIN_YEAR = 1970;

type WheelRow<T> = {
  key: string;
  value: T;
  label: string;
};

/** Static row text — selection is shown by the center overlay, not per-row styling. */
const WheelListItem = memo(function WheelListItem({ label }: { label: string }) {
  const { colors } = useTheme();

  return (
    <View style={styles.item}>
      <Text style={[styles.itemText, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
});

type WheelColumnProps<T> = {
  rows: WheelRow<T>[];
  value: T;
  onValueChange: (value: T) => void;
  flex: number;
  compare?: (a: T, b: T) => boolean;
};

function clampIndex(index: number, rowCount: number) {
  return Math.max(0, Math.min(rowCount - 1, index));
}

function indexForValue<T>(
  rows: WheelRow<T>[],
  value: T,
  compare: (a: T, b: T) => boolean,
) {
  const index = rows.findIndex((row) => compare(row.value, value));
  return index >= 0 ? index : 0;
}

function computeTargetIndex(
  offsetY: number,
  velocityY: number,
  dragStartIndex: number,
  rowCount: number,
) {
  const nearest = clampIndex(Math.round(offsetY / ITEM_HEIGHT), rowCount);
  if (Math.abs(velocityY) <= FLICK_VELOCITY_THRESHOLD) {
    return nearest;
  }

  const direction = velocityY > 0 ? 1 : -1;
  const steps = Math.min(MAX_FLICK_ROWS, Math.max(1, Math.round(Math.abs(velocityY) * 0.15)));
  return clampIndex(dragStartIndex + direction * steps, rowCount);
}

function WheelColumn<T>({
  rows,
  value,
  onValueChange,
  flex,
  compare = (a, b) => a === b,
}: WheelColumnProps<T>) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const indexRef = useRef(indexForValue(rows, value, compare));
  const dragStartIndexRef = useRef(indexRef.current);
  const interactingRef = useRef(false);
  const hasMountedRef = useRef(false);
  const gestureFinishedRef = useRef(false);

  const scrollToIndex = useCallback((index: number) => {
    const clamped = clampIndex(index, rows.length);
    scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: false });
    indexRef.current = clamped;
  }, [rows.length]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      scrollToIndex(indexForValue(rows, value, compare));
      return;
    }
    if (interactingRef.current) return;

    const nextIndex = indexForValue(rows, value, compare);
    if (nextIndex === indexRef.current) return;
    scrollToIndex(nextIndex);
  }, [compare, rows, scrollToIndex, value]);

  const finishGesture = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (gestureFinishedRef.current) return;
      gestureFinishedRef.current = true;

      const { contentOffset, velocity } = event.nativeEvent;
      const target = computeTargetIndex(
        contentOffset.y,
        velocity?.y ?? 0,
        dragStartIndexRef.current,
        rows.length,
      );

      scrollToIndex(target);
      dragStartIndexRef.current = target;
      interactingRef.current = false;

      const nextValue = rows[target]?.value;
      if (nextValue !== undefined && !compare(nextValue, value)) {
        void Haptics.selectionAsync();
        onValueChange(nextValue);
      }
    },
    [compare, onValueChange, rows, scrollToIndex, value],
  );

  return (
    <View style={[styles.column, { flex, height: WHEEL_HEIGHT }]}>
      <View
        pointerEvents="none"
        style={[
          styles.selectionOverlay,
          {
            backgroundColor: colorWithAlpha(colors.accent, 0.22),
            borderColor: colorWithAlpha(colors.accent, 0.45),
          },
        ]}
      />
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        bounces={false}
        overScrollMode="never"
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          interactingRef.current = true;
          gestureFinishedRef.current = false;
          dragStartIndexRef.current = indexRef.current;
        }}
        onScrollEndDrag={finishGesture}
        onMomentumScrollEnd={finishGesture}>
        {rows.map((row) => (
          <WheelListItem key={row.key} label={row.label} />
        ))}
      </ScrollView>
    </View>
  );
}

type Props = {
  value: string;
  onChange: (isoDate: string) => void;
  surfaceColor?: string;
};

export function AnniversaryWheelPicker({ value, onChange, surfaceColor }: Props) {
  const { colors } = useTheme();
  const fadeBase = surfaceColor ?? colors.background;

  const parsed = parseAnniversaryDate(value);
  const [parts, setParts] = useState({
    month: parsed.getMonth(),
    day: parsed.getDate(),
    year: parsed.getFullYear(),
  });

  useEffect(() => {
    const next = parseAnniversaryDate(value);
    setParts((prev) => {
      if (
        prev.month === next.getMonth() &&
        prev.day === next.getDate() &&
        prev.year === next.getFullYear()
      ) {
        return prev;
      }
      return {
        month: next.getMonth(),
        day: next.getDate(),
        year: next.getFullYear(),
      };
    });
  }, [value]);

  const { month, day, year } = parts;

  const monthRows = useMemo<WheelRow<number>[]>(
    () =>
      MONTHS.map((m) => ({
        key: `month-${m}`,
        value: m,
        label: format(new Date(2024, m, 1), 'MMM'),
      })),
    [],
  );

  const yearRows = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: currentYear - MIN_YEAR + 1 }, (_, i) => {
      const y = currentYear - i;
      return { key: `year-${y}`, value: y, label: String(y) };
    });
  }, []);

  const dayRows = useMemo(() => {
    const maxDay = getDaysInMonth(new Date(year, month, 1));
    return Array.from({ length: maxDay }, (_, i) => {
      const d = i + 1;
      return { key: `day-${d}`, value: d, label: String(d) };
    });
  }, [month, year]);

  const commitParts = useCallback(
    (nextMonth: number, nextDay: number, nextYear: number) => {
      const maxDay = getDaysInMonth(new Date(nextYear, nextMonth, 1));
      const clampedDay = Math.min(nextDay, maxDay);
      setParts({ month: nextMonth, day: clampedDay, year: nextYear });
      onChange(formatAnniversaryForDb(new Date(nextYear, nextMonth, clampedDay)));
    },
    [onChange],
  );

  return (
    <View style={styles.wheelRow}>
      <WheelColumn
        rows={monthRows}
        value={month}
        flex={1.2}
        onValueChange={(m) => commitParts(m, day, year)}
      />
      <WheelColumn rows={dayRows} value={day} flex={0.85} onValueChange={(d) => commitParts(month, d, year)} />
      <WheelColumn rows={yearRows} value={year} flex={1.05} onValueChange={(y) => commitParts(month, day, y)} />

      <LinearGradient
        pointerEvents="none"
        colors={[fadeBase, colorWithAlpha(fadeBase, 0)]}
        style={styles.fadeTop}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[colorWithAlpha(fadeBase, 0), fadeBase]}
        style={styles.fadeBottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wheelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: WHEEL_HEIGHT,
    width: '100%',
    gap: COLUMN_GAP,
    paddingHorizontal: 4,
  },
  column: { overflow: 'hidden', position: 'relative', minWidth: 72 },
  list: { flex: 1, backgroundColor: 'transparent', zIndex: 1 },
  listContent: { paddingVertical: WHEEL_PAD },
  selectionOverlay: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: (WHEEL_HEIGHT - ITEM_HEIGHT) / 2,
    height: ITEM_HEIGHT,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 0,
  },
  item: {
    height: ITEM_HEIGHT,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  itemText: {
    fontSize: 19,
    letterSpacing: -0.2,
    fontWeight: '500',
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.5,
    zIndex: 2,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.5,
    zIndex: 2,
  },
});
