import { format, isBefore, isSameDay, isToday, startOfDay } from 'date-fns';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { paperEdge } from '@/components/ui/primitives';
import { Icon, type IconName } from '@/components/ui/Icon';
import { EVENT_TYPE_META, getEventTypeColors } from '@/constants/calendar-events';
import { Radius } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { isPlanCompleted, parsePlanMeta } from '@/lib/plan-meta';
import type { CalendarEvent } from '@/types/database';

function groupLabel(day: Date): string {
  if (isToday(day)) return `Today · ${format(day, 'EEE, MMM d')}`;
  return format(day, 'EEE, MMM d');
}

type AgendaGroup = { key: string; label: string; events: CalendarEvent[] };

function groupEvents(events: CalendarEvent[]): AgendaGroup[] {
  const map = new Map<string, AgendaGroup>();
  for (const event of events) {
    const at = startOfDay(new Date(event.date_time));
    const key = format(at, 'yyyy-MM-dd');
    const existing = map.get(key);
    if (existing) existing.events.push(event);
    else map.set(key, { key, label: groupLabel(at), events: [event] });
  }
  return Array.from(map.values()).map((g) => ({
    ...g,
    events: [...g.events].sort(
      (a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime(),
    ),
  }));
}

/** The empty state used across Plan: an icon, a title and a line, centred, nothing to tap. */
export function PlanEmptyState({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
        <Icon name={icon} size={26} color={colors.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>{body}</Text>
    </View>
  );
}

export function PlanAgendaList({
  events,
  selectedDate,
  onPressEvent,
  hideGroupLabel = false,
  emptyTitle,
  emptyBody,
}: {
  events: CalendarEvent[];
  /** Picks the past-day wording when nothing was planned. */
  selectedDate?: Date;
  onPressEvent?: (event: CalendarEvent) => void;
  hideGroupLabel?: boolean;
  /** Wording for the current filter; defaults to a general "nothing planned". */
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const { colors } = useTheme();
  const groups = groupEvents(events);
  const isPastEmpty =
    !!selectedDate && isBefore(startOfDay(selectedDate), startOfDay(new Date())) && groups.length === 0;

  if (groups.length === 0) {
    return (
      <PlanEmptyState
        icon={isPastEmpty ? 'moon' : 'calendar'}
        title={isPastEmpty ? 'A quiet day' : emptyTitle ?? 'Nothing planned'}
        body={isPastEmpty ? 'No plans on this day.' : emptyBody ?? 'Plans for this day will show here.'}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      {groups.map((group) => (
        <View key={group.key} style={styles.group}>
          {!hideGroupLabel ? (
            <Text style={[styles.groupLabel, { color: colors.accent }]}>{group.label}</Text>
          ) : null}
          {group.events.map((event, index) => (
            <Animated.View key={event.id} entering={FadeInDown.delay(index * 50).duration(260)}>
              <PlanCard event={event} done={isPlanCompleted(event)} onPress={onPressEvent} />
            </Animated.View>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * Time column on the left (the Structured / Apple Calendar day-view pattern —
 * when a plan happens is the first thing you scan for), then a card with a
 * type-colored accent bar, title, location and the plan's icon.
 */
function PlanCard({
  event,
  done,
  onPress,
}: {
  event: CalendarEvent;
  done: boolean;
  onPress?: (event: CalendarEvent) => void;
}) {
  const { colors } = useTheme();
  const tc = getEventTypeColors(event.type, colors);
  const at = new Date(event.date_time);
  const meta = parsePlanMeta(event.description);
  const typeLabel = EVENT_TYPE_META[event.type]?.label ?? 'Plan';

  return (
    <Pressable
      onPress={() => onPress?.(event)}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${format(at, 'h:mm a')}${done ? ', done' : ''}`}>
      <View style={styles.timeCol}>
        <Text
          style={[styles.time, { color: done ? colors.textTertiary : colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          maxFontSizeMultiplier={1.2}>
          {format(at, 'h:mm')}
        </Text>
        <Text style={[styles.ampm, { color: colors.textTertiary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.2}>
          {format(at, 'a')}
        </Text>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth,
            opacity: done ? 0.6 : 1,
          },
        ]}>
        <View style={[styles.bar, { backgroundColor: done ? colors.textTertiary : tc.main }]} />
        <View style={styles.body}>
          <Text
            style={[
              styles.title,
              { color: colors.text, textDecorationLine: done ? 'line-through' : 'none' },
            ]}
            numberOfLines={2}>
            {event.title}
          </Text>
          <View style={styles.metaRow}>
            {meta.location ? (
              <>
                <Icon name="location" size={12} color={colors.textSecondary} />
                <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                  {meta.location}
                </Text>
              </>
            ) : (
              <Text style={[styles.meta, { color: tc.main }]} numberOfLines={1}>
                {typeLabel}
              </Text>
            )}
          </View>
        </View>
        {done ? (
          <View style={[styles.badge, { backgroundColor: colors.surfaceElevated }, paperEdge(colors)]}>
            <Icon name="check" size={18} color={colors.success} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function buildDayEvents(
  selectedDate: Date,
  upcoming: CalendarEvent[],
  monthEvents: CalendarEvent[],
): CalendarEvent[] {
  const map = new Map<string, CalendarEvent>();
  for (const e of [...monthEvents, ...upcoming]) map.set(e.id, e);
  return Array.from(map.values())
    .filter((e) => isSameDay(new Date(e.date_time), selectedDate))
    .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
}

/** @deprecated Prefer buildDayEvents — kept for any older imports. */
export function buildAgendaEvents(
  selectedDate: Date,
  upcoming: CalendarEvent[],
  monthEvents: CalendarEvent[],
): CalendarEvent[] {
  return buildDayEvents(selectedDate, upcoming, monthEvents);
}

const styles = StyleSheet.create({
  wrap: { gap: 22 },
  group: { gap: 10 },
  groupLabel: { fontSize: 13, fontWeight: '700', paddingHorizontal: 2 },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  // Fixed width for the longest time ("12:45"), so every card lines up.
  timeCol: { width: 60, flexShrink: 0, alignItems: 'flex-end', paddingTop: 14 },
  time: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  ampm: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  body: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  badge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: { fontSize: 19 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2, textAlign: 'center' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
});
