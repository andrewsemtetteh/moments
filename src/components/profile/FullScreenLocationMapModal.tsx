import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocationMapPreview, type MapMarker } from '@/components/moments/LocationMapPreview';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { openInMaps } from '@/lib/location';

interface Props {
  visible: boolean;
  markers: MapMarker[];
  title?: string | null;
  onClose: () => void;
}

export function FullScreenLocationMapModal({ visible, markers, title, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  if (markers.length === 0) return null;

  const centerLat = markers.reduce((sum, m) => sum + m.latitude, 0) / markers.length;
  const centerLng = markers.reduce((sum, m) => sum + m.longitude, 0) / markers.length;
  const subtitle =
    markers.length > 1
      ? markers.map((m) => m.label).filter(Boolean).join(' · ')
      : markers[0].label ?? 'Shared location';

  const openExternal = () => {
    openInMaps(centerLat, centerLng, title ?? subtitle);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
          <View style={styles.titleWrap}>
            {title ? (
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.iconBtn} accessibilityLabel="Close map">
            <Icon name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={[styles.mapWrap, { paddingBottom: insets.bottom + 12 }]}>
          <LocationMapPreview markers={markers} interactive style={styles.map} />
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            onPress={openExternal}
            style={[styles.openBtn, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Open in maps app">
            <Icon name="location" size={18} color={colors.onAccent} />
            <Text style={[styles.openBtnText, { color: colors.onAccent }]}>Open in Maps</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  titleWrap: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 13, fontWeight: '500' },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapWrap: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  map: {
    flex: 1,
    height: undefined,
    borderRadius: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  openBtnText: { fontSize: 15, fontWeight: '700' },
});
