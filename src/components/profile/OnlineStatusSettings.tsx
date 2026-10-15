import * as Haptics from '@/lib/haptics';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { setLocalOnlineStatusSharing } from '@/lib/partner-presence';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';
import { AppSwitch } from '@/components/ui/AppSwitch';

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
          <View style={[styles.iconWrap, { backgroundColor: colors.boldBorder ? colors.backgroundElevated : colors.surfaceElevated }]}>
            <Icon name={enabled ? 'eye' : 'eyeOff'} size={20} color={colors.text} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.text }]}>Show when I’m online</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={2}>
              {enabled
                ? "You can see each other's online status"
                : "Hidden for both. You won't see theirs either"}
            </Text>
          </View>
        </View>
        <AppSwitch
          value={enabled}
          onValueChange={(value) => void onToggle(value)}
          disabled={saving}
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  sub: { fontSize: 13, marginTop: 2, lineHeight: 17 },
});
