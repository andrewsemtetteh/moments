import { format, getDaysInMonth } from 'date-fns';
import * as Haptics from '@/lib/haptics';
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

function WheelColumn<T>({
  rows,
  value,
  onValueChange,
  flex,
  compare = (a, b) => a === b,
}: WheelColumnProps<T>) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [initialIndex] = useState(() => indexForValue(rows, value, compare));
  /** The row under the highlight right now (updates while scrolling). */
  const liveIndexRef = useRef(initialIndex);
  const draggingRef = useRef(false);
  const settlingRef = useRef(false);

  // Follow outside changes (e.g. the day clamps when the month gets shorter),
  // but never fight a finger or a coast that's still going.
  useEffect(() => {
    if (draggingRef.current || settlingRef.current) return;
    const next = indexForValue(rows, value, compare);
    if (next === liveIndexRef.current) return;
    liveIndexRef.current = next;
    scrollRef.current?.scrollTo({ y: next * ITEM_HEIGHT, animated: true });
  }, [compare, rows, value]);

  // A light tick as each row passes the middle, like the iOS picker.
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = clampIndex(Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT), rows.length);
      if (index === liveIndexRef.current) return;
      liveIndexRef.current = index;
      void Haptics.selectionAsync();
    },
    [rows.length],
  );

  // Only commit once it has come to rest on a row.
  const settle = useCallback(
    (offsetY: number) => {
      draggingRef.current = false;
      settlingRef.current = false;
      const index = clampIndex(Math.round(offsetY / ITEM_HEIGHT), rows.length);
      liveIndexRef.current = index;
      const nextValue = rows[index]?.value;
      if (nextValue !== undefined && !compare(nextValue, value)) onValueChange(nextValue);
    },
    [compare, onValueChange, rows, value],
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
        // Start on the value with no jump on mount.
        contentOffset={{ x: 0, y: initialIndex * ITEM_HEIGHT }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        // Native snapping and momentum: flicks coast and land on a row smoothly.
        snapToInterval={ITEM_HEIGHT}
        decelerationRate={0.988}
        disableIntervalMomentum={false}
        bounces
        overScrollMode="never"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          draggingRef.current = true;
          settlingRef.current = false;
        }}
        onScrollEndDrag={(e) => {
          draggingRef.current = false;
          // A flick (or a snap back to a row) is followed by momentum events.
          settlingRef.current = true;
          const v = e.nativeEvent.velocity?.y ?? 0;
          const y = e.nativeEvent.contentOffset.y;
          if (Math.abs(v) < 0.01 && Math.abs(y - Math.round(y / ITEM_HEIGHT) * ITEM_HEIGHT) < 0.5) settle(y);
        }}
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}>
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
  /** The earliest year on the wheel (birthdays go back further than anniversaries). */
  minYear?: number;
  /** The latest year on the wheel (birthdays stop at the youngest allowed age). */
  maxYear?: number;
};

export function AnniversaryWheelPicker({ value, onChange, surfaceColor, minYear = MIN_YEAR, maxYear }: Props) {
  const { colors } = useTheme();
  const fadeBase = surfaceColor ?? colors.background;

  const parsed = parseAnniversaryDate(value);
  const [parts, setParts] = useState({
    month: parsed.getMonth(),
    day: parsed.getDate(),
    year: parsed.getFullYear(),
  });

  // A new value from outside moves the wheels (while rendering, once per value).
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    const next = parseAnniversaryDate(value);
    setParts((prev) =>
      prev.month === next.getMonth() && prev.day === next.getDate() && prev.year === next.getFullYear()
        ? prev
        : { month: next.getMonth(), day: next.getDate(), year: next.getFullYear() },
    );
  }

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
    const lastYear = maxYear ?? new Date().getFullYear();
    return Array.from({ length: lastYear - minYear + 1 }, (_, i) => {
      const y = lastYear - i;
      return { key: `year-${y}`, value: y, label: String(y) };
    });
  }, [minYear, maxYear]);

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
