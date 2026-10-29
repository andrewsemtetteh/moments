import { Image } from 'expo-image';
import { mediaSource } from '@/lib/storage-cdn';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TurboModuleRegistry,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import MapView, { Marker as LegacyMarker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import type { CameraRef, LngLat, LngLatBounds } from '@maplibre/maplibre-react-native';

import { Icon } from '@/components/ui/Icon';
import { CARTOON_MAP_DARK, CARTOON_MAP_LIGHT, cartoonMapStyle } from '@/lib/map-style';
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

/** What both map engines draw: the props above minus the frame, plus the theme bits they need. */
interface MapBodyProps {
  markers: MapMarker[];
  interactive: boolean;
  focusedIndex: number | null;
  recenterKey: number;
  onMarkerPress?: (index: number) => void;
  onMapPress?: () => void;
  dark: boolean;
  fallback: string;
}

type MapLibreModule = typeof import('@maplibre/maplibre-react-native');

/**
 * MapLibre needs its native code: Expo Go (and a dev build made before it was added) doesn't have it,
 * so those keep the old react-native-maps map instead of crashing.
 */
const MapLibre: MapLibreModule | null = (() => {
  if (Platform.OS === 'web' || TurboModuleRegistry.get('MLRNMapViewModule') == null) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- only loaded when the native module is there
    return require('@maplibre/maplibre-react-native') as MapLibreModule;
  } catch {
    return null;
  }
})();

const PIN_EDGE = { top: 70, right: 50, bottom: 50, left: 50 };

/** Close enough that buildings, shops and street names show (and stand up in 3D when tilted). */
const STREET_ZOOM = 16.5;
/** The full map's tilt on one spot, so the buildings stand up. */
const TILT = 45;
/** Pins closer together than this (degrees) are treated as one spot. */
const STREET_DELTA = 0.004;

function initial(name?: string | null) {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first.charAt(0).toUpperCase() : '?';
}

/** Where the camera goes: the focused pin or one spot at street level, or a box around everyone. */
function cameraTarget(
  markers: MapMarker[],
  focusedIndex: number | null,
): { center: LngLat; bounds?: undefined } | { center?: undefined; bounds: LngLatBounds } {
  const focus = focusedIndex != null ? markers[focusedIndex] : undefined;
  if (focus) return { center: [focus.longitude, focus.latitude] };
  const lats = markers.map((m) => m.latitude);
  const lngs = markers.map((m) => m.longitude);
  const [west, south, east, north] = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
  if (east - west < STREET_DELTA && north - south < STREET_DELTA) {
    return { center: [(west + east) / 2, (south + north) / 2] };
  }
  return { bounds: [west, south, east, north] };
}

/**
 * A map with each person as a photo pin, drawn the cartoon way (Snap Map style): MapLibre with our
 * own style on free OpenStreetMap tiles (OpenFreeMap, see lib/map-style), the same on both phones,
 * with sticker pins (photo, white ring, bold ink outline). Expo Go falls back to react-native-maps.
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

  // Inside screens that swipe (profile, Moments), the map's own drag / pinch must win
  // once it starts, or the screen's swipe steals it and the map won't move.
  const mapGesture = useMemo(() => Gesture.Native().disallowInterruption(true), []);

  if (markers.length === 0) return null;

  const sizeStyle = StyleSheet.flatten(style)?.flex != null ? { flex: 1, minHeight: 120 } : { height };
  const body: MapBodyProps = {
    markers,
    interactive,
    focusedIndex,
    recenterKey,
    onMarkerPress,
    onMapPress,
    dark: colors.isDark,
    fallback: colors.gradient[0],
  };

  const map = (
    <View style={[styles.wrapper, sizeStyle, { borderColor: colors.border }, style]}>
      <GestureDetector gesture={mapGesture}>
        {MapLibre ? <CartoonMap {...body} lib={MapLibre} /> : <ExpoGoMap {...body} />}
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

/** The MapLibre map: our cartoon style, 3D buildings, places and photo pins. */
function CartoonMap({
  lib,
  markers,
  interactive,
  focusedIndex,
  recenterKey,
  onMarkerPress,
  onMapPress,
  dark,
  fallback,
}: MapBodyProps & { lib: MapLibreModule }) {
  const { Map, Camera, Marker } = lib;
  const cameraRef = useRef<CameraRef>(null);
  const mapStyle = useMemo(() => cartoonMapStyle(dark), [dark]);
  // Only real moves re-aim the camera, not a parent handing in a new array of the same pins.
  const spots = markers.map((m) => `${m.latitude},${m.longitude}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `spots` stands for `markers`
  const target = useMemo(() => cameraTarget(markers, focusedIndex), [spots, focusedIndex]);
  const pitch = interactive && target.center ? TILT : 0;

  // The first view comes from initialViewState; after that, glide to the new spot or the new box.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const camera = cameraRef.current;
    if (!camera) return;
    if (target.center) camera.flyTo({ center: target.center, zoom: STREET_ZOOM, pitch, duration: 700 });
    else camera.fitBounds(target.bounds, { padding: PIN_EDGE, pitch: 0, bearing: 0, duration: 700 });
  }, [target, recenterKey, pitch]);

  // A tap on a pin can also reach the map: wait a beat and only count it if no pin was tapped.
  const pinPressedAt = useRef(0);
  const mapPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (mapPressTimer.current) clearTimeout(mapPressTimer.current);
    },
    [],
  );

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={mapStyle}
      dragPan={interactive}
      touchZoom={interactive}
      doubleTapZoom={interactive}
      doubleTapHoldZoom={interactive}
      touchRotate={interactive}
      touchPitch={interactive}
      compass={interactive}
      compassHiddenFacingNorth
      logo={false}
      // OpenStreetMap's credit (the little "i"), as its licence asks.
      attribution
      attributionPosition={{ bottom: 6, left: 8 }}
      pointerEvents={interactive ? 'auto' : 'none'}
      onPress={() => {
        if (!onMapPress) return;
        if (mapPressTimer.current) clearTimeout(mapPressTimer.current);
        mapPressTimer.current = setTimeout(() => {
          if (Date.now() - pinPressedAt.current > 400) onMapPress();
        }, 150);
      }}>
      <Camera
        ref={cameraRef}
        maxZoom={19}
        initialViewState={
          target.center
            ? { center: target.center, zoom: STREET_ZOOM, pitch }
            : { bounds: target.bounds, padding: PIN_EDGE }
        }
      />
      {markers.map((m, i) => (
        <Marker
          key={`${m.latitude},${m.longitude},${i}`}
          id={`pin-${i}`}
          lngLat={[m.longitude, m.latitude]}
          anchor="bottom"
          onPress={
            onMarkerPress
              ? () => {
                  pinPressedAt.current = Date.now();
                  onMarkerPress(i);
                }
              : undefined
          }>
          <PinBody marker={m} fallback={fallback} showName={interactive} />
        </Marker>
      ))}
    </Map>
  );
}

/**
 * Expo Go only (no MapLibre there): react-native-maps, Apple Maps on iPhone and Google Maps with the
 * cartoon colours on Android.
 */
function ExpoGoMap({ markers, interactive, focusedIndex, recenterKey, onMarkerPress, onMapPress, dark, fallback }: MapBodyProps) {
  const mapRef = useRef<MapView>(null);
  const region = useMemo<Region>(() => {
    const target = cameraTarget(markers, focusedIndex);
    if (target.center) {
      const [longitude, latitude] = target.center;
      return { latitude, longitude, latitudeDelta: STREET_DELTA, longitudeDelta: STREET_DELTA };
    }
    const [west, south, east, north] = target.bounds;
    return {
      latitude: (south + north) / 2,
      longitude: (west + east) / 2,
      latitudeDelta: (north - south) * 1.6,
      longitudeDelta: (east - west) * 1.6,
    };
  }, [markers, focusedIndex]);

  const fit = () => {
    if (!mapRef.current) return;
    if (region.latitudeDelta === STREET_DELTA) {
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

  return (
    <MapView
      ref={mapRef}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
      style={StyleSheet.absoluteFill}
      initialRegion={region}
      onMapReady={fit}
      mapType="standard"
      customMapStyle={Platform.OS === 'android' ? (dark ? CARTOON_MAP_DARK : CARTOON_MAP_LIGHT) : undefined}
      showsBuildings
      userInterfaceStyle={dark ? 'dark' : 'light'}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={interactive}
      pitchEnabled={interactive}
      toolbarEnabled={false}
      showsCompass={interactive}
      showsPointsOfInterests
      liteMode={Platform.OS === 'android' && !interactive}
      pointerEvents={interactive ? 'auto' : 'none'}
      onPress={(e) => {
        // Taps on a pin come through here too (Android): only a tap on the map itself.
        if ((e.nativeEvent as { action?: string }).action !== 'marker-press') onMapPress?.();
      }}>
      {markers.map((m, i) => (
        <LegacyPin
          key={`${m.latitude},${m.longitude},${i}`}
          marker={m}
          fallback={fallback}
          onPress={onMarkerPress ? () => onMarkerPress(i) : undefined}
          showTitle={interactive}
        />
      ))}
    </MapView>
  );
}

function LegacyPin({
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
    <LegacyMarker
      coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
      anchor={{ x: 0.5, y: 1 }}
      title={showTitle ? marker.label || undefined : undefined}
      onPress={onPress}
      tracksViewChanges={tracking}>
      <PinBody marker={marker} fallback={fallback} onPhotoLoad={() => setTracking(false)} />
    </LegacyMarker>
  );
}

/**
 * A sticker pin: round photo (or initial), white ring, bold ink outline and a little pointer
 * (Bitmoji / Snap Map style), with the name in a pill above it on the full map.
 */
function PinBody({
  marker,
  fallback,
  showName = false,
  onPhotoLoad,
}: {
  marker: MapMarker;
  fallback: string;
  showName?: boolean;
  onPhotoLoad?: () => void;
}) {
  const name = showName ? marker.label || marker.name : null;
  return (
    <View style={styles.pin}>
      {name ? (
        <View style={styles.namePill}>
          <Text style={styles.nameText} numberOfLines={1}>
            {name}
          </Text>
        </View>
      ) : null}
      <View style={[styles.face, { borderColor: '#fff', shadowColor: '#000' }]}>
        <View style={[styles.ring, { borderColor: INK }]} />
        {marker.avatarUrl ? (
          <Image source={mediaSource(marker.avatarUrl)} style={styles.photo} contentFit="cover" onLoad={onPhotoLoad} />
        ) : (
          <View style={[styles.photo, styles.initialBox, { backgroundColor: fallback }]}>
            <Text style={styles.initialText}>{initial(marker.name || marker.label)}</Text>
          </View>
        )}
      </View>
      <View style={[styles.pointer, { borderTopColor: INK }]} />
    </View>
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
  pin: { alignItems: 'center', minWidth: 48 },
  namePill: {
    maxWidth: 120,
    marginBottom: 7,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: INK,
    backgroundColor: '#fff',
  },
  nameText: { color: INK, fontSize: 12, fontWeight: '800' },
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
