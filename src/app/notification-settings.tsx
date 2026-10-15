import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { SettingsToggleDivider, SettingsToggleRow } from '@/components/profile/SettingsToggleRow';
import { Icon } from '@/components/ui/Icon';
import { Spacing, type ThemeColors } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { loadExpoNotifications } from '@/lib/expo-notifications-safe';
import * as Haptics from '@/lib/haptics';
import { NOTIFICATION_CATEGORIES, type NotificationPrefs } from '@/lib/notification-prefs';
import { closeStackScreen } from '@/lib/router';
import * as api from '@/services/api';
import { useAuthStore } from '@/stores';

/** Settings > Notifications: the phone-level permission, then one switch per kind of alert. */
export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [prefs, setPrefs] = useState<NotificationPrefs>(user?.notification_prefs ?? {});

  // Phone-level permission, re-read when coming back from the system Settings app.
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    const Notifications = loadExpoNotifications();
    if (!Notifications) return;
    const read = () =>
      void Notifications.getPermissionsAsync()
        .then((p) => setAllowed(p.granted))
        .catch(() => setAllowed(null));
    read();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') read();
    });
    return () => sub.remove();
  }, []);

  const allowNotifications = async () => {
    const Notifications = loadExpoNotifications();
    if (Notifications && allowed === false) {
      const asked = await Notifications.requestPermissionsAsync().catch(() => null);
      if (asked?.granted) {
        setAllowed(true);
        return;
      }
    }
    void Linking.openSettings();
  };

  const toggle = async (key: string, value: boolean) => {
    if (!user) return;
    void Haptics.selectionAsync();
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      const updated = await api.updateProfile(user.id, { notification_prefs: next });
      if (updated) setUser(updated);
    } catch (e) {
      setPrefs(previous);
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const off = allowed === false;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Notifications" onBack={() => closeStackScreen(router)} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 16 }]}>
        {off ? (
          <Pressable
            onPress={() => void allowNotifications()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.card, styles.banner, surface(colors), pressed && styles.pressed]}>
            <Icon name="bell" size={20} color={colors.accent} />
            <Text style={[styles.bannerText, { color: colors.text }]}>Notifications are off for Moments</Text>
            <Text style={[styles.bannerAction, { color: colors.accent }]}>Turn on</Text>
          </Pressable>
        ) : null}

        <View style={[styles.card, styles.group, surface(colors), off && styles.dimmed]}>
          {NOTIFICATION_CATEGORIES.map((c, i) => (
            <View key={c.key}>
              {i > 0 ? <SettingsToggleDivider /> : null}
              <SettingsToggleRow
                icon={c.icon}
                title={c.label}
                subtitle={c.detail}
                value={prefs[c.key] !== false}
                disabled={off}
                onChange={(v) => void toggle(c.key, v)}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function surface(colors: ThemeColors) {
  return { backgroundColor: colors.surface, borderWidth: colors.boldBorder ? 2 : 0, borderColor: colors.border };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs, gap: 16 },
  card: { borderRadius: 22 },
  group: { overflow: 'hidden', paddingVertical: 2 },
  pressed: { opacity: 0.7 },
  dimmed: { opacity: 0.5 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  bannerText: { flex: 1, fontSize: 15, fontWeight: '600' },
  bannerAction: { fontSize: 15, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14 },
  tile: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowBody: {
    flex: 1,
    minHeight: 56,
    marginLeft: 12,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
});
