import { Image } from 'expo-image';
import { mediaSource } from '@/lib/storage-cdn';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';

import { Icon } from '@/components/ui/Icon';
import { CARTOON_MAP_DARK, CARTOON_MAP_LIGHT } from '@/lib/map-style';
import { useTheme } from '@/hooks/useTheme';

export interface MapMarker {
  latitude: number;
  longitude: number;
  /** Tooltip text on the map pin. */
  label?: string;
  /** Profile name used for avatar initials when there is no photo. */
  name?: string | null;
  color?: string;
  avatarUrl?: string | null;
}

interface LocationMapPreviewProps {
  markers: MapMarker[];
  height?: number;
  interactive?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Index of a marker to zoom in close on, instead of the default fit-everyone view. */
  focusedIndex?: number | null;
  /** Called with the marker's index when a pin is tapped (interactive maps). */
  onMarkerPress?: (index: number) => void;
  /** Bump to re-fit everyone (the full map's "show everyone" button). */
  recenterKey?: number;
  /** A tap on the map itself (not a pin), e.g. to open it full screen. */
  onMapPress?: () => void;
}

const PIN_EDGE = { top: 70, right: 50, bottom: 50, left: 50 };

function initial(name?: string | null) {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first.charAt(0).toUpperCase() : '?';
}

/** Where the camera starts: the focused pin up close, one pin nearby, or a box around everyone. */
function startRegion(markers: MapMarker[], focusedIndex: number | null): Region {
  const focus = focusedIndex != null ? markers[focusedIndex] : undefined;
  if (focus) return { latitude: focus.latitude, longitude: focus.longitude, latitudeDelta: 0.004, longitudeDelta: 0.004 };
  if (markers.length === 1) {
    return { latitude: markers[0].latitude, longitude: markers[0].longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 };
  }
  const lats = markers.map((m) => m.latitude);
  const lngs = markers.map((m) => m.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.02),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.02),
  };
}

/**
 * A map with each person as a photo pin. Native maps (Apple Maps on iPhone, Google Maps
 * on Android) via react-native-maps, drawn the cartoon way (Snap Map style): bright flat
 * colours on Android (see lib/map-style), Apple's soft "muted" map on iPhone, and sticker
 * pins (photo, white ring, bold ink outline) everywhere.
 * Non-interactive maps are a still preview (tap opens the full map via `onPress`).
 */
export function LocationMapPreview({
  markers,
  height = 180,
  interactive = false,
  onPress,
  style,
  focusedIndex = null,
  onMarkerPress,
  recenterKey = 0,
  onMapPress,
}: LocationMapPreviewProps) {
  const { colors } = useTheme();
  const mapRef = useRef<MapView>(null);
  const region = useMemo(() => startRegion(markers, focusedIndex), [markers, focusedIndex]);

  // Fit everyone on screen with room for the pins; refit when the people or the focus change.
  const fit = () => {
    if (!mapRef.current || markers.length === 0) return;
    if (focusedIndex != null || markers.length === 1) {
      mapRef.current.animateToRegion(region, 0);
      return;
    }
    mapRef.current.fitToCoordinates(
      markers.map((m) => ({ latitude: m.latitude, longitude: m.longitude })),
      { edgePadding: PIN_EDGE, animated: false },
    );
  };
  useEffect(() => {
    fit();
    // fit reads the same values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, recenterKey]);

  // Inside screens that swipe (profile, Moments), the map's own drag / pinch must win
  // once it starts, or the screen's swipe steals it and the map won't move.
  const mapGesture = useMemo(() => Gesture.Native().disallowInterruption(true), []);

  if (markers.length === 0) return null;

  const sizeStyle = StyleSheet.flatten(style)?.flex != null ? { flex: 1, minHeight: 120 } : { height };

  const map = (
    <View style={[styles.wrapper, sizeStyle, { borderColor: colors.border }, style]}>
      <GestureDetector gesture={mapGesture}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onMapReady={fit}
        // Cartoon: flat and friendly, not satellite. Android takes our colours; iPhone's
        // Apple Maps can't be restyled, so it uses its softest look.
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        customMapStyle={Platform.OS === 'android' ? (colors.isDark ? CARTOON_MAP_DARK : CARTOON_MAP_LIGHT) : undefined}
        showsBuildings={false}
        userInterfaceStyle={colors.isDark ? 'dark' : 'light'}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsCompass={interactive}
        showsPointsOfInterests={false}
        liteMode={Platform.OS === 'android' && !interactive}
        pointerEvents={interactive ? 'auto' : 'none'}
        onPress={(e) => {
          // Taps on a pin come through here too (Android): only a tap on the map itself.
          if ((e.nativeEvent as { action?: string }).action !== 'marker-press') onMapPress?.();
        }}>
        {markers.map((m, i) => (
          <PhotoPin
            key={`${m.latitude},${m.longitude},${i}`}
            marker={m}
            fallback={colors.gradient[0]}
            onPress={onMarkerPress ? () => onMarkerPress(i) : undefined}
            showTitle={interactive}
          />
        ))}
      </MapView>
      </GestureDetector>
      {onPress && (
        <View style={styles.openHint} pointerEvents="none">
          <Icon name="expand" size={14} color="#fff" />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
        {map}
      </Pressable>
    );
  }

  return map;
}

/** A round photo (or initial) in the person's colour ring, with a little pointer under it. */
function PhotoPin({
  marker,
  fallback,
  onPress,
  showTitle,
}: {
  marker: MapMarker;
  fallback: string;
  onPress?: () => void;
  showTitle: boolean;
}) {
  // Android draws custom pins once as a bitmap: keep redrawing until the photo has loaded.
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracking(false), 1500);
    return () => clearTimeout(t);
  }, [marker.avatarUrl]);

  return (
    <Marker
      coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
      anchor={{ x: 0.5, y: 1 }}
      title={showTitle ? marker.label || undefined : undefined}
      onPress={onPress}
      tracksViewChanges={tracking}>
      <View style={styles.pin}>
        {/* A sticker: photo, white ring, bold ink outline (Bitmoji / Snap Map style). */}
        <View style={[styles.face, { borderColor: '#fff', shadowColor: '#000' }]}>
          <View style={[styles.ring, { borderColor: INK }]} />
          {marker.avatarUrl ? (
            <Image
              source={mediaSource(marker.avatarUrl)}
              style={styles.photo}
              contentFit="cover"
              onLoad={() => setTracking(false)}
            />
          ) : (
            <View style={[styles.photo, styles.initialBox, { backgroundColor: fallback }]}>
              <Text style={styles.initialText}>{initial(marker.name || marker.label)}</Text>
            </View>
          )}
        </View>
        <View style={[styles.pointer, { borderTopColor: INK }]} />
      </View>
    </Marker>
  );
}

const AVATAR = 42;
const INK = '#111111';

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  openHint: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.92 },
  pin: { alignItems: 'center', width: 48 },
  face: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 3,
    backgroundColor: '#fff',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  ring: {
    position: 'absolute',
    top: -5.5,
    left: -5.5,
    right: -5.5,
    bottom: -5.5,
    borderRadius: (AVATAR + 11) / 2,
    borderWidth: 3,
  },
  photo: { width: '100%', height: '100%', borderRadius: AVATAR / 2 },
  initialBox: { alignItems: 'center', justifyContent: 'center' },
  initialText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  pointer: {
    width: 0,
    height: 0,
    marginTop: 1,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
