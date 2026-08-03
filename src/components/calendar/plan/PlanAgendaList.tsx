import { format, isBefore, isSameDay, isToday, startOfDay } from 'date-fns';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import { EVENT_TYPE_META, getEventTypeColors } from '@/constants/calendar-events';
import { useTheme } from '@/hooks/useTheme';
import { isPlanCompleted, parsePlanMeta, planKindEmoji } from '@/lib/plan-meta';
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

export function PlanAgendaList({
  events,
  selectedDate,
  onPressEvent,
  emptyAction,
  hideGroupLabel = false,
}: {
  events: CalendarEvent[];
  /** When set, hide “Add a plan” for past empty days. */
  selectedDate?: Date;
  onPressEvent?: (event: CalendarEvent) => void;
  emptyAction?: () => void;
  hideGroupLabel?: boolean;
}) {
  const { colors } = useTheme();
  const groups = groupEvents(events);
  const isPastEmpty =
    !!selectedDate &&
    isBefore(startOfDay(selectedDate), startOfDay(new Date())) &&
    groups.length === 0;
  const showAdd = !!emptyAction && !isPastEmpty;

  if (groups.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {isPastEmpty ? 'Nothing planned' : 'Nothing planned yet'}
        </Text>
        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
          {isPastEmpty
            ? 'This day came and went without a plan.'
            : 'Every memory starts with one plan.'}
        </Text>
        {showAdd ? (
          <PrimaryButton label="Add a plan" onPress={emptyAction} style={styles.emptyBtn} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {groups.map((group) => {
        const useTimeline = group.events.length > 1;
        return (
          <View key={group.key} style={styles.group}>
            {!hideGroupLabel ? (
              <Text style={[styles.groupLabel, { color: colors.accent }]}>{group.label}</Text>
            ) : null}

            {useTimeline ? (
              <View style={styles.timeline}>
                {group.events.map((event, index) => {
                  const done = isPlanCompleted(event);
                  const isLast = index === group.events.length - 1;

                  return (
                    <View key={event.id} style={styles.timelineRow}>
                      <View style={styles.rail}>
                        <View
                          style={[
                            styles.node,
                            {
                              backgroundColor: done ? colors.accent : colors.surface,
                              borderColor: done ? colors.accent : colors.borderStrong,
                            },
                          ]}>
                          {done ? <Icon name="check" size={10} color={colors.onAccent} /> : null}
                        </View>
                        {!isLast ? (
                          <View
                            style={[
                              styles.railLine,
                              { backgroundColor: done ? colors.accent : colors.border },
                            ]}
                          />
                        ) : null}
                      </View>
                      <View style={styles.timelineCardWrap}>
                        <PlanCard event={event} done={done} onPress={onPressEvent} />
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              group.events.map((event) => (
                <PlanCard
                  key={event.id}
                  event={event}
                  done={isPlanCompleted(event)}
                  onPress={onPressEvent}
                />
              ))
            )}
          </View>
        );
      })}
    </View>
  );
}

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
  const emoji = planKindEmoji(event) ?? EVENT_TYPE_META[event.type].emoji;

  return (
    <Pressable
      onPress={() => onPress?.(event)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          opacity: pressed ? 0.9 : done ? 0.75 : 1,
        },
      ]}>
      <View style={[styles.dot, { backgroundColor: done ? colors.accent : tc.main }]} />
      <View style={styles.body}>
        <Text
          style={[
            styles.title,
            {
              color: colors.text,
              textDecorationLine: done ? 'line-through' : 'none',
            },
          ]}
          numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={[styles.time, { color: colors.textSecondary }]}>
          {format(at, 'h:mm a')}
          {meta.location ? ` · ${meta.location}` : ''}
        </Text>
      </View>
      <View style={[styles.thumb, { backgroundColor: done ? colors.accentSoft : tc.soft }]}>
        <Text style={styles.thumbEmoji}>{emoji}</Text>
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
  group: { gap: 8 },
  groupLabel: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 2,
  },
  timeline: { gap: 0 },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
  },
  rail: {
    width: 18,
    alignItems: 'center',
  },
  node: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    zIndex: 1,
  },
  railLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: -4,
    borderRadius: 1,
  },
  timelineCardWrap: { flex: 1, paddingBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  time: { fontSize: 13, fontWeight: '500' },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: { fontSize: 20 },
  empty: {
    paddingVertical: 28,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 4 },
  emptyBtn: { marginTop: 8, minWidth: 160 },
});
