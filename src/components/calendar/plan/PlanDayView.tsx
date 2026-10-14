import { format } from 'date-fns';
import * as Haptics from '@/lib/haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { displayTitle, isHiddenFrom, planOwner } from '@/lib/plan-day';
import { parsePlanMeta } from '@/lib/plan-meta';
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

/** One-tap reply to your partner's day note (inline, like the design). */
const CHEER = 'Sending love 💞';

/**
 * Upcoming → the selected day for both of you: day notes (today only),
 * when you're both free, and a lane each. "Together" plans show in both lanes.
 */
export function PlanDayView({
  day,
  isTodaySelected,
  events,
  me,
  partner,
  myNote,
  partnerNote,
  freeLabel,
  onPressEvent,
  onPlanFree,
  onSaveMyNote,
  onCheer,
}: {
  day: Date;
  isTodaySelected: boolean;
  events: CalendarEvent[];
  me: UserProfile | null;
  partner: UserProfile | null;
  myNote: CalendarEvent | null;
  partnerNote: CalendarEvent | null;
  freeLabel: string | null;
  onPressEvent: (event: CalendarEvent) => void;
  onPlanFree: () => void;
  onSaveMyNote: (text: string) => void;
  onCheer: (note: CalendarEvent, cheer: string) => void;
}) {
  const { colors } = useTheme();
  const partnerName = getFirstName(partner?.name) ?? 'Partner';
  const [editingNote, setEditingNote] = useState(false);
  const myNoteText = myNote ? parsePlanMeta(myNote.description).notes ?? '' : '';
  const [draft, setDraft] = useState(myNoteText);

  const myCheerOnPartner = partnerNote && me ? parsePlanMeta(partnerNote.description).reactions?.[me.id] : undefined;
  const partnerCheerOnMine = myNote && partner ? parsePlanMeta(myNote.description).reactions?.[partner.id] : undefined;

  const lanes: { key: string; name: string; profile: UserProfile | null; color: string; items: CalendarEvent[] }[] = [
    {
      key: 'me',
      name: 'You',
      profile: me,
      color: colors.warning,
      items: events.filter((e) => {
        const o = planOwner(e);
        return o === 'together' || o === me?.id;
      }),
    },
    {
      key: 'partner',
      name: partnerName,
      profile: partner,
      color: PARTNER_COLOR,
      items: events.filter((e) => {
        const o = planOwner(e);
        return o === 'together' || (o !== me?.id && o !== 'together');
      }),
    },
  ];

  const saveNote = () => {
    const text = draft.trim();
    setEditingNote(false);
    if (text === myNoteText) return;
    onSaveMyNote(text);
  };

  return (
    <View style={styles.root}>
      {isTodaySelected && partnerNote ? (
        <View style={[styles.noteRow, { backgroundColor: colors.surface }]}>
          <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={30} />
          <Text style={[styles.noteText, { color: colors.text }]} numberOfLines={2}>
            {partnerName}: “{parsePlanMeta(partnerNote.description).notes}”
          </Text>
          {myCheerOnPartner ? (
            <Icon name="heart" size={18} color={colors.accent} filled />
          ) : (
            <Pressable
              onPress={() => {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onCheer(partnerNote, CHEER);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Send ${partnerName} love`}
              style={({ pressed }) => [styles.cheerBtn, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}>
              <Icon name="heart" size={14} color={colors.accent} />
              <Text style={[styles.cheerText, { color: colors.accent }]}>Send love</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {isTodaySelected ? (
        editingNote ? (
          <View style={[styles.noteRow, { backgroundColor: colors.surface }]}>
            <Avatar name={me?.name} imageUrl={me?.avatar_url} size={30} />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="What's your day like?"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={saveNote}
              onBlur={saveNote}
              style={[styles.noteInput, { color: colors.text }]}
            />
          </View>
        ) : (
          <Pressable
            onPress={() => {
              setDraft(myNoteText);
              setEditingNote(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={myNoteText ? 'Edit your note for today' : 'Add a note about your day'}
            style={({ pressed }) => [styles.noteRow, { backgroundColor: colors.surface }, pressed && styles.pressed]}>
            <Avatar name={me?.name} imageUrl={me?.avatar_url} size={30} />
            <Text
              style={[styles.noteText, { color: myNoteText ? colors.text : colors.textTertiary }]}
              numberOfLines={2}>
              {myNoteText ? `You: “${myNoteText}”` : `Tell ${partnerName} about your day…`}
            </Text>
            {partnerCheerOnMine ? (
              <Text style={[styles.cheerSent, { color: colors.accent }]}>{partnerCheerOnMine}</Text>
            ) : null}
          </Pressable>
        )
      ) : null}

      {freeLabel ? (
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

      <View style={styles.lanes}>
        {lanes.map((lane) => (
          <View key={lane.key} style={[styles.lane, { backgroundColor: colors.surface }]}>
            <View style={styles.laneHead}>
              <Avatar name={lane.profile?.name} imageUrl={lane.profile?.avatar_url} size={22} />
              <Text style={[styles.laneName, { color: colors.text }]} numberOfLines={1}>
                {lane.name}
              </Text>
            </View>
            {lane.items.length === 0 ? (
              <Text style={[styles.laneEmpty, { color: colors.textTertiary }]}>Nothing planned</Text>
            ) : (
              lane.items.map((event) => {
                const hidden = isHiddenFrom(event, me?.id);
                const owner = planOwner(event);
                return (
                  <Pressable
                    key={`${lane.key}-${event.id}`}
                    disabled={hidden}
                    onPress={() => onPressEvent(event)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
                    <View
                      style={[
                        styles.itemBar,
                        { backgroundColor: hidden ? colors.border : ownerColor(owner, me?.id, colors) },
                      ]}
                    />
                    <View style={styles.itemText}>
                      <Text style={[styles.itemTime, { color: colors.textTertiary }]}>
                        {format(new Date(event.date_time), 'h:mm a')}
                      </Text>
                      <Text
                        style={[styles.itemTitle, { color: hidden ? colors.textTertiary : colors.text }]}
                        numberOfLines={1}>
                        {displayTitle(event, me?.id)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  pressed: { opacity: 0.7 },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    minHeight: 50,
  },
  noteText: { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  noteInput: { flex: 1, fontSize: 14, fontWeight: '700', padding: 0 },
  cheerSent: { fontSize: 13, fontWeight: '800' },
  cheerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 10, borderRadius: 15 },
  cheerText: { fontSize: 13, fontWeight: '800' },
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
  lanes: { flexDirection: 'row', gap: 10 },
  lane: { flex: 1, minWidth: 0, borderRadius: 18, padding: 12, gap: 10 },
  laneHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  laneName: { flex: 1, fontSize: 14, fontWeight: '800' },
  laneEmpty: { fontSize: 13, fontWeight: '600' },
  item: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  itemBar: { width: 3, borderRadius: 2 },
  itemText: { flex: 1, minWidth: 0, gap: 1 },
  itemTime: { fontSize: 12, fontWeight: '700' },
  itemTitle: { fontSize: 14, fontWeight: '700' },
});
