import * as Haptics from '@/lib/haptics';
import { useEffect, useState } from 'react';
import { Alert, AppState, StyleSheet, Switch, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useLocationSharing } from '@/hooks/useLocationSharing';
import { useTheme } from '@/hooks/useTheme';
import { getCurrentPlace, hasLocationPermission, openAppSettings } from '@/lib/location';

function showLocationError(message: string, reason?: string) {
  // "Not now" on the permission sheet: they already chose, no alert needed.
  if (!message) return;
  const buttons: { text: string; onPress?: () => void; style?: 'cancel' | 'default' }[] = [
    { text: 'OK', style: 'cancel' },
  ];
  if (reason === 'permission_denied' || reason === 'services_disabled') {
    buttons.unshift({ text: 'Open Settings', onPress: openAppSettings });
  }
  Alert.alert('Location unavailable', message, buttons);
}

export function LocationSharingSettings() {
  const { colors } = useTheme();
  const { enabled, setSharingEnabled, loaded } = useLocationSharing();
  const [locating, setLocating] = useState(false);
  // Instant switch feedback, decoupled from the GPS/network round trip below.
  const [pendingEnabled, setPendingEnabled] = useState<boolean | null>(null);
  // On only counts with permission: a switch that's "on" but never allowed shows as off,
  // and turning it on is the one place that asks.
  const [permitted, setPermitted] = useState<boolean | null>(null);
  useEffect(() => {
    void hasLocationPermission().then(setPermitted);
  }, []);
  const switchValue = pendingEnabled ?? (enabled && permitted === true);

  /** `silent`: automatic updates show no alerts or haptics. */
  const refreshMyLocation = async (silent = false) => {
    setLocating(true);
    try {
      const result = await getCurrentPlace();
      if (!result.ok) {
        if (!silent) showLocationError(result.message, result.reason);
        return false;
      }
      await setSharingEnabled(true, result.place);
      if (!silent) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } finally {
      setLocating(false);
    }
  };

  // Keeps your spot current on its own: once on open, every 2 minutes, and whenever the
  // app comes back to the foreground. Only with permission already granted, so it never prompts.
  useEffect(() => {
    if (!loaded || !enabled || !permitted) return;
    const update = () => {
      void hasLocationPermission().then((ok) => (ok ? refreshMyLocation(true) : undefined));
    };
    update();
    const interval = setInterval(update, 2 * 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, enabled, permitted]);

  const onToggle = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingEnabled(value);

    if (value) {
      setLocating(true);
      const result = await getCurrentPlace();
      setLocating(false);
      if (!result.ok) {
        setPendingEnabled(null);
        showLocationError(result.message, result.reason);
        return;
      }
      setPermitted(true);
      try {
        await setSharingEnabled(true, result.place);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } finally {
        setPendingEnabled(null);
      }
      return;
    }

    try {
      await setSharingEnabled(false);
    } finally {
      setPendingEnabled(null);
    }
  };

  if (!loaded) return null;

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={[styles.iconWrap, { backgroundColor: colors.boldBorder ? colors.backgroundElevated : colors.surfaceElevated }]}>
            <Icon name="location" size={20} color={colors.text} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.text }]}>Share my location</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={2}>
              {switchValue
                ? "You can see each other's location"
                : "Hidden for both. You won't see theirs either"}
            </Text>
          </View>
        </View>
        <Switch
          value={switchValue}
          onValueChange={(value) => void onToggle(value)}
          disabled={locating}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor="#FFFFFF"
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
