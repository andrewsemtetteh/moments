import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AnniversaryCountdownMilestone } from '@/components/profile/AnniversaryCountdownMilestone';
import { EditAnniversaryModal } from '@/components/profile/EditAnniversaryModal';
import { getRelationshipAnniversaryIso, hasCustomAnniversaryDate } from '@/lib/anniversary';
import { useTheme } from '@/hooks/useTheme';
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

  const saveAnniversary = async (isoDate: string) => {
    setSaving(true);
    try {
      const updated = await api.updateRelationship(relationship.id, { anniversary_date: isoDate });
      setRelationship(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditOpen(false);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.body, { backgroundColor: colors.background }]}>
          <AnniversaryCountdownMilestone anniversaryIso={anniversaryIso} onEdit={() => setEditOpen(true)} />
          {usingDefault ? (
            <Text style={[styles.defaultHint, { color: colors.textTertiary }]}>
              Using your join date — tap to set your real anniversary
            </Text>
          ) : null}
        </View>
      </View>

      <EditAnniversaryModal
        visible={editOpen}
        value={anniversaryIso}
        saving={saving}
        onClose={() => setEditOpen(false)}
        onSave={saveAnniversary}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginTop: 18,
  },
  body: { padding: 16, gap: 8 },
  defaultHint: { fontSize: 12, lineHeight: 17, textAlign: 'center', fontWeight: '500' },
});
