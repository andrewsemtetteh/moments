import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

export interface PlaceCoords {
  latitude: number;
  longitude: number;
}

export interface PlaceSnapshot extends PlaceCoords {
  label: string;
}

export type LocationFailureReason = 'permission_denied' | 'services_disabled' | 'unavailable';

export type LocationResult =
  | { ok: true; place: PlaceSnapshot }
  | { ok: false; reason: LocationFailureReason; message: string };

const POSITION_TIMEOUT_MS = 25_000;

function formatPlace(place: Location.LocationGeocodedAddress | undefined): string | null {
  if (!place) return null;
  const parts = [place.name, place.street, place.city, place.region, place.country].filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.length > 0 ? unique.join(', ') : null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function readPositionViaWatch(timeoutMs: number): Promise<Location.LocationObject | null> {
  return new Promise((resolve) => {
    let subscription: Location.LocationSubscription | undefined;
    const timer = setTimeout(() => {
      subscription?.remove();
      resolve(null);
    }, timeoutMs);

    void Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 500,
        distanceInterval: 0,
        mayShowUserSettingsDialog: true,
      },
      (location) => {
        clearTimeout(timer);
        subscription?.remove();
        resolve(location);
      },
    )
      .then((sub) => {
        subscription = sub;
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

async function readPosition(): Promise<Location.LocationObject | null> {
  const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 3_600_000 }).catch(() => null);
  if (lastKnown?.coords) return lastKnown;

  const accuracies = [Location.Accuracy.Lowest, Location.Accuracy.Low, Location.Accuracy.Balanced];
  for (const accuracy of accuracies) {
    try {
      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy, mayShowUserSettingsDialog: true }),
        POSITION_TIMEOUT_MS,
      );
      if (position?.coords) return position;
    } catch {
      // Try next accuracy level.
    }
  }

  return readPositionViaWatch(POSITION_TIMEOUT_MS);
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentPlace(): Promise<LocationResult> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    return {
      ok: false,
      reason: 'services_disabled',
      message: 'Location services are turned off on this device. Enable them in system settings and try again.',
    };
  }

  if (Platform.OS === 'android') {
    await Location.enableNetworkProviderAsync().catch(() => undefined);
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return {
      ok: false,
      reason: 'permission_denied',
      message: 'Moments needs location permission to share where you are. Allow access in Settings.',
    };
  }

  const position = await readPosition();
  if (!position) {
    return {
      ok: false,
      reason: 'unavailable',
      message:
        Platform.OS === 'web'
          ? 'Your browser could not determine a location. Allow location access for this site and try again.'
          : 'Could not get a GPS fix. On an emulator, set a mock location in device settings, then try again.',
    };
  }

  const { latitude, longitude } = position.coords;

  let label: string | null = null;
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    label = formatPlace(place);
  } catch {
    // Reverse geocoding can fail offline; fall back to coordinates.
  }

  return {
    ok: true,
    place: {
      latitude,
      longitude,
      label: label ?? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    },
  };
}

export function hasValidCoords(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  );
}

export function openInMaps(latitude: number, longitude: number, label?: string | null) {
  const query = encodeURIComponent(label?.trim() || `${latitude},${longitude}`);
  const url = Platform.select({
    ios: `maps:0,0?q=${query}&ll=${latitude},${longitude}`,
    android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${query})`,
    default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
  });
  if (url) void Linking.openURL(url);
}

export function openAppSettings() {
  void Linking.openSettings();
}
