import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { EditAnniversaryModal } from '@/components/profile/EditAnniversaryModal';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import {
  getAnniversaryCountdown,
  getRelationshipAnniversaryIso,
  hasCustomAnniversaryDate,
  isValidAnniversaryIso,
} from '@/lib/anniversary';
import { toUserFacingNetworkError } from '@/lib/network-error';
import * as api from '@/services/api';
import { useRelationshipStore } from '@/stores';
import type { Relationship } from '@/types/database';

/**
 * You page · Anniversary: the next anniversary, days to go, how far through
 * this year together you are, and a pencil to change the date.
 * `relationship` overrides the store (dev preview); editing is off then.
 */
export function ProfileAnniversarySection({ relationship: override }: { relationship?: Relationship } = {}) {
  const { colors } = useTheme();
  const stored = useRelationshipStore((s) => s.relationship);
  const relationship = override ?? stored;
  const setRelationship = useRelationshipStore((s) => s.setRelationship);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!relationship || relationship.status === 'ended' || !relationship.created_at) {
    return null;
  }

  const anniversaryIso = getRelationshipAnniversaryIso(relationship);
  const usingDefault = !hasCustomAnniversaryDate(relationship);
  const { daysUntil, togetherDays, anniversaryDate } = getAnniversaryCountdown(anniversaryIso);
  const isToday = daysUntil === 0;
  const yearNumber = Math.floor(togetherDays / 365) + 1;
  const yearProgress = Math.min(1, Math.max(0, 1 - daysUntil / 365));

  const openEdit = () => {
    if (override) return;
    void Haptics.selectionAsync();
    setEditOpen(true);
  };

  const saveAnniversary = async (isoDate: string) => {
    if (!isValidAnniversaryIso(isoDate)) {
      Alert.alert('Invalid date', 'Please pick a valid anniversary date.');
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateRelationshipAnniversary(relationship.id, isoDate);
      setRelationship(updated);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditOpen(false);
    } catch (e) {
      const err = toUserFacingNetworkError(e, 'Please try again.');
      Alert.alert('Could not save', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Anniversary</Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: colors.boldBorder ? 2 : 0,
          },
        ]}>
        <View style={styles.top}>
          <View style={[styles.tile, { backgroundColor: colors.accentSoft }]}>
            <Icon name="calendar" size={24} color={colors.accent} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.kicker, { color: colors.textSecondary }]}>
              {isToday ? 'Happy anniversary' : 'Next anniversary'}
            </Text>
            <Text style={[styles.date, { color: colors.text }]} numberOfLines={1}>
              {isToday ? 'Today 🎉' : format(anniversaryDate, 'EEEE, d MMMM yyyy')}
            </Text>
          </View>
          {!isToday ? (
            <View style={styles.days}>
              <Text style={[styles.daysNum, { color: colors.text }]}>{daysUntil}</Text>
              <Text style={[styles.daysUnit, { color: colors.textSecondary }]}>
                day{daysUntil === 1 ? '' : 's'}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.track, { backgroundColor: colors.boldBorder ? colors.backgroundElevated : colors.surfaceElevated }]}>
          <View style={[styles.fill, { width: `${yearProgress * 100}%`, backgroundColor: colors.accent }]} />
        </View>

        <View style={styles.bottom}>
          <Text style={[styles.progress, { color: colors.textSecondary }]}>
            {isToday ? `Year ${yearNumber} starts today` : `${Math.round(yearProgress * 100)}% through year ${yearNumber}`}
          </Text>
          {!override ? (
            <Pressable
              onPress={openEdit}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Change anniversary date"
              style={({ pressed }) => [styles.editBtn, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}>
              <Icon name="edit" size={16} color={colors.accent} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {usingDefault ? (
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          Using the day you joined. Tap the pencil to set your real anniversary.
        </Text>
      ) : null}

      <EditAnniversaryModal
        visible={editOpen}
        value={anniversaryIso}
        saving={saving}
        onClose={() => setEditOpen(false)}
        onSave={saveAnniversary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  card: { borderRadius: 22, padding: 16, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 14, fontWeight: '800' },
  date: { fontSize: 16, fontWeight: '800' },
  days: { alignItems: 'flex-end' },
  daysNum: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6, lineHeight: 28 },
  daysUnit: { fontSize: 12, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { fontSize: 13, fontWeight: '600' },
  editBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  hint: { fontSize: 13, lineHeight: 18, paddingHorizontal: 6 },
});
