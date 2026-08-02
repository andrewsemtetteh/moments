import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { setLocalOnlineStatusSharing } from '@/lib/partner-presence';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';

/** Privacy toggle: share online / last-active, or appear as Away. */
export function OnlineStatusSettings() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const [saving, setSaving] = useState(false);

  const enabled = user?.show_online_status !== false;

  const onToggle = useCallback(
    async (value: boolean) => {
      if (!user || saving) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSaving(true);

      const previous = user;
      setUser({ ...user, show_online_status: value, last_seen_at: value ? user.last_seen_at : new Date().toISOString() });
      if (relationshipId) {
        setLocalOnlineStatusSharing(relationshipId, value);
      }

      try {
        const updated = await api.updateOnlineStatusVisibility(user.id, value);
        setUser({ ...previous, ...updated });
      } catch (e) {
        setUser(previous);
        if (relationshipId) {
          setLocalOnlineStatusSharing(relationshipId, previous.show_online_status !== false);
        }
        Alert.alert(
          'Could not update',
          e instanceof Error ? e.message : 'Please try again.',
        );
      } finally {
        setSaving(false);
      }
    },
    [user, saving, setUser, relationshipId],
  );

  if (!user) return null;

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.iconWrap}>
            <Icon name={enabled ? 'eye' : 'eyeOff'} size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.text }]}>Show online status</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={2}>
              {enabled
                ? "You can see each other's online status"
                : "Hidden for both. You won't see theirs either"}
            </Text>
          </View>
        </View>
        <Switch
          value={enabled}
          onValueChange={(value) => void onToggle(value)}
          disabled={saving}
          trackColor={{ false: colors.border, true: colors.accentSoft }}
          thumbColor={enabled ? colors.accent : colors.surfaceElevated}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    flex: 1,
    minWidth: 0,
  },
  iconWrap: {
    height: 20,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  sub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
});
