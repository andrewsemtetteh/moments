import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AnniversaryCountdownMilestone } from '@/components/profile/AnniversaryCountdownMilestone';
import { EditAnniversaryModal } from '@/components/profile/EditAnniversaryModal';
import { Icon } from '@/components/ui/Icon';
import { Radius, Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import {
  formatAnniversaryDisplay,
  formatTogetherLabel,
  getAnniversaryCountdown,
  getRelationshipAnniversaryIso,
  hasCustomAnniversaryDate,
  isValidAnniversaryIso,
} from '@/lib/anniversary';
import { toUserFacingNetworkError } from '@/lib/network-error';
import * as api from '@/services/api';
import { useRelationshipStore } from '@/stores';

export function ProfileAnniversarySection() {
  const { colors } = useTheme();
  const relationship = useRelationshipStore((s) => s.relationship);
  const setRelationship = useRelationshipStore((s) => s.setRelationship);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!relationship || relationship.status === 'ended' || !relationship.created_at) {
    return null;
  }

  const anniversaryIso = getRelationshipAnniversaryIso(relationship);
  const usingDefault = !hasCustomAnniversaryDate(relationship);
  const { togetherDays, togetherSince } = getAnniversaryCountdown(anniversaryIso);

  const openEdit = () => setEditOpen(true);

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
    <View style={styles.stack}>
      <AnniversaryCountdownMilestone anniversaryIso={anniversaryIso} onEdit={openEdit} />

      <Pressable
        onPress={openEdit}
        style={({ pressed }) => [
          styles.togetherRow,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.88 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Edit together since date">
        <View style={[styles.togetherIcon, { backgroundColor: colors.accentSoft }]}>
          <Icon name="heart" size={18} color={colors.accent} filled />
        </View>
        <View style={styles.togetherCopy}>
          <Text style={[styles.togetherLabel, { color: colors.textSecondary }]}>Together since</Text>
          <Text style={[styles.togetherDate, { color: colors.text }]}>
            {formatAnniversaryDisplay(togetherSince)}
          </Text>
          <Text style={[styles.togetherMeta, { color: colors.accent }]}>
            {formatTogetherLabel(togetherSince, togetherDays)}
          </Text>
        </View>
        <Icon name="chevronRight" size={18} color={colors.textTertiary} />
      </Pressable>

      {usingDefault ? (
        <Text style={[styles.defaultHint, { color: colors.textTertiary }]}>
          Using your join date. Tap to set your real anniversary.
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
  stack: {
    gap: Spacing.sm,
  },
  togetherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  togetherIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  togetherCopy: { flex: 1, gap: 2 },
  togetherLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  togetherDate: { fontSize: 16, fontWeight: '800' },
  togetherMeta: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  defaultHint: { fontSize: 12, lineHeight: 17, textAlign: 'center', fontWeight: '500' },
});
