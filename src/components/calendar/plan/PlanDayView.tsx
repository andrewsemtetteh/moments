import { format } from 'date-fns';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Avatar, separatorColor, cardSurface } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { displayTitle, isHiddenFrom, planOwner } from '@/lib/plan-day';
import { parsePlanMeta } from '@/lib/plan-meta';
import { PlanEmptyState } from '@/components/calendar/plan/PlanAgendaList';
import type { CalendarEvent, UserProfile } from '@/types/database';

/** Partner lane / dot color — the blue half of the m♥ments hearts. */
export const PARTNER_COLOR = '#5B8DEF';

export function ownerColor(
  owner: string,
  meId: string | undefined,
  colors: ReturnType<typeof useTheme>['colors'],
) {
  if (owner === 'together') return colors.accent;
  return owner === meId ? colors.warning : PARTNER_COLOR;
}

/**
 * Upcoming → the selected day for both of you: when you're both free, then every
 * plan in one list by time, each with the faces of who it's for (both of you for a
 * plan together, otherwise just the one person).
 */
export function PlanDayView({
  day,
  isTodaySelected,
  events,
  me,
  partner,
  freeLabel,
  onPressEvent,
  onPlanFree,
  emptyTitle,
  emptyBody,
}: {
  day: Date;
  isTodaySelected: boolean;
  events: CalendarEvent[];
  me: UserProfile | null;
  partner: UserProfile | null;
  freeLabel: string | null;
  onPressEvent: (event: CalendarEvent) => void;
  onPlanFree: () => void;
  /** Wording for the current filter when the day has nothing. */
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const { colors } = useTheme();
  const partnerName = getFirstName(partner?.name) ?? 'Partner';

  const sorted = [...events].sort((x, y) => new Date(x.date_time).getTime() - new Date(y.date_time).getTime());

  const whoFor = (event: CalendarEvent) => {
    const owner = planOwner(event);
    if (owner === 'together') return { people: [me, partner], label: 'Together' };
    if (owner === me?.id) return { people: [me], label: 'You' };
    return { people: [partner], label: partnerName };
  };

  return (
    <View style={styles.root}>
      {/* Only alongside plans: an empty day shows just its empty state. */}
      {freeLabel && sorted.length > 0 ? (
        <Pressable
          onPress={onPlanFree}
          accessibilityRole="button"
          style={({ pressed }) => [styles.freeBar, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}>
          <Icon name="heart" size={18} color={colors.accent} filled />
          <Text style={[styles.freeText, { color: colors.text }]}>
            {isTodaySelected ? 'You’re both free ' : `Both free ${format(day, 'EEE')} `}
            <Text style={{ color: colors.accent }}>{freeLabel}</Text>
          </Text>
          <Text style={[styles.freeAction, { color: colors.accent }]}>Plan something</Text>
        </Pressable>
      ) : null}

      {sorted.length === 0 ? (
        <PlanEmptyState
          icon={day < new Date(new Date().toDateString()) ? 'moon' : 'calendar'}
          title={day < new Date(new Date().toDateString()) ? 'A quiet day' : emptyTitle ?? 'Nothing planned'}
          body={
            day < new Date(new Date().toDateString())
              ? 'No plans on this day.'
              : emptyBody ?? 'Plans for this day will show here.'
          }
        />
      ) : (
      <View style={[styles.list, cardSurface(colors)]}>
        {(
          sorted.map((event, i) => {
            const hidden = isHiddenFrom(event, me?.id);
            const owner = planOwner(event);
            const at = new Date(event.date_time);
            const tint = hidden ? colors.border : ownerColor(owner, me?.id, colors);
            const place = hidden ? undefined : parsePlanMeta(event.description).location;
            const who = whoFor(event);
            return (
              <Pressable
                key={event.id}
                disabled={hidden}
                onPress={() => onPressEvent(event)}
                accessibilityRole="button"
                accessibilityLabel={`${format(at, 'h:mm a')}, ${displayTitle(event, me?.id)}, ${who.label}`}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && { borderTopWidth: 1, borderTopColor: separatorColor(colors) },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.time}>
                  <Text
                    style={[styles.timeMain, { color: colors.text }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    maxFontSizeMultiplier={1.2}>
                    {format(at, 'h:mm')}
                  </Text>
                  <Text
                    style={[styles.timeAmPm, { color: colors.textTertiary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    maxFontSizeMultiplier={1.2}>
                    {format(at, 'a')}
                  </Text>
                </View>
                <View style={[styles.bar, { backgroundColor: tint }]} />
                <View style={styles.body}>
                  <View style={styles.titleRow}>
                    <Text
                      style={[styles.title, { color: hidden ? colors.textTertiary : colors.text }]}
                      numberOfLines={1}>
                      {displayTitle(event, me?.id)}
                    </Text>
                  </View>
                  <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {place ? `${who.label} · ${place}` : who.label}
                  </Text>
                </View>
                <View style={styles.faces}>
                  {who.people.map((person, j) => (
                    <View
                      key={j}
                      style={[styles.face, j > 0 && styles.faceOverlap, { borderColor: colors.surface }]}>
                      <Avatar name={person?.name} imageUrl={person?.avatar_url} size={28} />
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })
        )}
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  pressed: { opacity: 0.7 },
  freeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
  },
  freeText: { flex: 1, fontSize: 14, fontWeight: '700' },
  freeAction: { fontSize: 13, fontWeight: '800' },
  list: { borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 64 },
  // Fixed width for the longest time ("12:45" / "PM"), so every row's bar lines up.
  time: { width: 60, flexShrink: 0, alignItems: 'flex-end' },
  timeMain: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timeAmPm: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  bar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 13, fontWeight: '600' },
  faces: { flexDirection: 'row', alignItems: 'center' },
  face: { borderWidth: 2, borderRadius: 16 },
  faceOverlap: { marginLeft: -10 },
});
