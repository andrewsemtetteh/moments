import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { LocationMapPreview } from '@/components/moments/LocationMapPreview';
import { Icon } from '@/components/ui/Icon';
import { useLocationSharing } from '@/hooks/useLocationSharing';
import { usePartnerLocationRealtime, useSharedLocationMap } from '@/hooks/useSharedLocationMap';
import { useTheme } from '@/hooks/useTheme';
import { getCurrentPlace, openAppSettings } from '@/lib/location';

function showLocationError(message: string, reason?: string) {
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
  const { markers, myPlace, partnerSharing, partnerOnMap, partner } = useSharedLocationMap();
  usePartnerLocationRealtime();
  const [locating, setLocating] = useState(false);

  const refreshMyLocation = async () => {
    setLocating(true);
    try {
      const result = await getCurrentPlace();
      if (!result.ok) {
        showLocationError(result.message, result.reason);
        return false;
      }
      await setSharingEnabled(true, result.place);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (!loaded || !enabled) return;
    const interval = setInterval(() => {
      void refreshMyLocation();
    }, 5 * 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, enabled]);

  const onToggle = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (value) {
      setLocating(true);
      const result = await getCurrentPlace();
      setLocating(false);
      if (!result.ok) {
        showLocationError(result.message, result.reason);
        return;
      }
      await setSharingEnabled(true, result.place);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    await setSharingEnabled(false);
  };

  if (!loaded) return null;

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.iconWrap}>
            <Icon name="location" size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.text }]}>Location sharing</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={2}>
              {enabled
                ? "You can see each other's location"
                : "Hidden for both. You won't see theirs either"}
            </Text>
          </View>
        </View>
        <Switch
          value={enabled}
          onValueChange={(value) => void onToggle(value)}
          disabled={locating}
          trackColor={{ false: colors.border, true: colors.accentSoft }}
          thumbColor={enabled ? colors.accent : colors.surfaceElevated}
        />
      </View>

      {enabled && (
        <View style={styles.previewBlock}>
          {locating && markers.length === 0 ? (
            <View style={[styles.loadingBox, { backgroundColor: colors.surfaceElevated }]}>
              <ActivityIndicator color={colors.accent} />
              <Text style={{ color: colors.textSecondary, marginTop: 8, fontWeight: '600' }}>
                Getting location…
              </Text>
            </View>
          ) : markers.length > 0 ? (
            <>
              <LocationMapPreview markers={markers} height={180} interactive={false} />
              <View style={styles.legend}>
                {myPlace && (
                  <Text style={[styles.legendItem, { color: colors.textSecondary }]}>
                    <Text style={{ color: '#e85d75' }}>●</Text> Me
                    {myPlace.label ? ` · ${myPlace.label}` : ''}
                  </Text>
                )}
                {partnerOnMap && (
                  <Text style={[styles.legendItem, { color: colors.textSecondary }]}>
                    <Text style={{ color: '#5b8def' }}>●</Text> {partner?.name?.trim() || 'Partner'}
                    {partner?.location_label ? ` · ${partner.location_label}` : ''}
                  </Text>
                )}
                {partner && !partnerSharing && (
                  <Text style={[styles.legendHint, { color: colors.textTertiary }]}>
                    {partner.name?.trim() || 'Your partner'} has location sharing off
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => void refreshMyLocation()}
                style={[
                  styles.secondaryBtn,
                  { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
                ]}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
                  Refresh location
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => void refreshMyLocation()}
              style={[
                styles.loadingBox,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}>
              <Icon name="location" size={28} color={colors.accent} />
              <Text style={{ color: colors.text, marginTop: 8, fontWeight: '700' }}>
                Tap to detect location
              </Text>
            </Pressable>
          )}
        </View>
      )}
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
  previewBlock: { gap: 10, paddingHorizontal: 16, paddingBottom: 16 },
  loadingBox: {
    height: 140,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  legend: { gap: 4 },
  legendItem: { fontSize: 13, lineHeight: 18 },
  legendHint: { fontSize: 12, marginTop: 2 },
  secondaryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
