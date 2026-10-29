import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import { APP_ICONS, appIconsSupported, currentAppIcon, setAppIcon, type AppIcon } from '@/lib/app-icon';
import * as Haptics from '@/lib/haptics';
import { useUIStore } from '@/stores';

const PAYWALL_REASON = 'Custom app icons';

/**
 * Settings › Appearance › App icon. Moments Plus picks any icon for the Home Screen; on Free
 * every icon but the original shows a lock and opens the paywall.
 */
export function AppIconPicker() {
  const { colors } = useTheme();
  const { isPlus } = useSubscription();
  const openPaywall = useUIStore((s) => s.openPaywall);
  const [current, setCurrent] = useState<string | null>(() => currentAppIcon());
  const [busy, setBusy] = useState(false);

  const choose = async (icon: AppIcon) => {
    if (busy || icon.id === current) return;
    if (icon.id !== null && !isPlus) {
      void Haptics.selectionAsync();
      openPaywall(PAYWALL_REASON);
      return;
    }
    if (!appIconsSupported()) {
      Alert.alert('Not available here', 'You can change the app icon in the App Store version of Moments.');
      return;
    }
    setBusy(true);
    try {
      await setAppIcon(icon.id);
      setCurrent(icon.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Couldn’t change the icon', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View style={styles.headingRow}>
        <Text style={[styles.heading, { color: colors.textSecondary }]}>App icon</Text>
        {!isPlus ? (
          <View style={[styles.plusPill, { backgroundColor: colors.accentSoft }]}>
            <Icon name="diamond" size={12} color={colors.accent} filled />
            <Text style={[styles.plusText, { color: colors.accent }]}>Plus</Text>
          </View>
        ) : null}
      </View>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: colors.boldBorder ? 2 : colors.sticker ? 1 : 0,
          },
        ]}>
        {APP_ICONS.map((icon) => {
          const selected = icon.id === current;
          const locked = icon.id !== null && !isPlus;
          return (
            <Pressable
              key={icon.id ?? 'original'}
              onPress={() => void choose(icon)}
              style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${icon.label} app icon${locked ? ', Moments Plus' : ''}`}
              accessibilityState={{ selected, disabled: busy }}>
              <View
                style={[
                  styles.ring,
                  { borderColor: selected ? colors.accent : 'transparent' },
                ]}>
                <Image source={icon.preview} style={styles.icon} contentFit="cover" />
                {locked ? (
                  <View style={[styles.badge, { backgroundColor: colors.text, borderColor: colors.surface }]}>
                    <Icon name="lock" size={11} color={colors.background} filled />
                  </View>
                ) : selected ? (
                  <View style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.surface }]}>
                    <Icon name="check" size={12} color={colors.onAccent} />
                  </View>
                ) : null}
              </View>
              <Text
                style={[styles.label, { color: selected ? colors.text : colors.textSecondary }, selected && styles.labelOn]}
                numberOfLines={1}>
                {icon.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const ICON = 60;

const styles = StyleSheet.create({
  // Matches Settings' subheadings ("Appearance").
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, paddingHorizontal: 4 },
  heading: { fontSize: 15, fontWeight: '700' },
  plusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 22, borderRadius: 11 },
  plusText: { fontSize: 12, fontWeight: '800' },
  card: { borderRadius: 22, flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 14, paddingHorizontal: 6, rowGap: 16 },
  cell: { width: '25%', alignItems: 'center', gap: 6 },
  pressed: { opacity: 0.7 },
  ring: { padding: 3, borderRadius: 19, borderWidth: 2.5 },
  // iOS draws Home Screen icons at about a 22% corner radius.
  icon: { width: ICON, height: ICON, borderRadius: 14 },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 12, fontWeight: '600' },
  labelOn: { fontWeight: '800' },
});
