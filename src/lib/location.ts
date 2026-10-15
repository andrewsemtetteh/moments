import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';
import { ensurePermission } from '@/lib/permissions';

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

export function formatPlace(place: Location.LocationGeocodedAddress | undefined): string | null {
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

/** Within this many metres counts as a precise fix: stop listening early. */
const GOOD_ACCURACY_M = 25;
/** How long to keep listening for a better GPS reading. */
const FIX_WINDOW_MS = 8000;

/**
 * Listen to GPS at full precision for a few seconds and keep the most accurate
 * reading (the first ones are often rough, from Wi-Fi or cell towers); stop as
 * soon as one is within GOOD_ACCURACY_M.
 */
async function readPrecisePosition(): Promise<Location.LocationObject | null> {
  return new Promise((resolve) => {
    let best: Location.LocationObject | null = null;
    let subscription: Location.LocationSubscription | undefined;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      subscription?.remove();
      resolve(best);
    };
    const timer = setTimeout(finish, FIX_WINDOW_MS);

    void Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 500,
        distanceInterval: 0,
        mayShowUserSettingsDialog: true,
      },
      (location) => {
        const acc = location.coords.accuracy ?? Number.POSITIVE_INFINITY;
        if (!best || acc < (best.coords.accuracy ?? Number.POSITIVE_INFINITY)) best = location;
        if (acc <= GOOD_ACCURACY_M) {
          clearTimeout(timer);
          finish();
        }
      },
    )
      .then((sub) => {
        subscription = sub;
        if (done) sub.remove();
      })
      .catch(() => {
        clearTimeout(timer);
        finish();
      });
  });
}

async function readPosition(): Promise<Location.LocationObject | null> {
  // 1. A fresh, precise GPS fix.
  const precise = await readPrecisePosition();
  if (precise?.coords) return precise;

  // 2. One high-accuracy reading.
  try {
    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: true }),
      POSITION_TIMEOUT_MS,
    );
    if (position?.coords) return position;
  } catch {
    // Fall back to the phone's last known spot.
  }

  // 3. Last resort: where the phone last was, if it's recent (10 minutes).
  const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 600_000 }).catch(() => null);
  return lastKnown?.coords ? lastKnown : null;
}

/** Already allowed? Never shows a prompt (for background refreshes). */
export async function hasLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Where you are now. Asks for location the friendly way first (our sheet,
 * then iPhone's); "Not now" comes back as permission_denied with no message.
 */
export async function getCurrentPlace(opts: { host?: string } = {}): Promise<LocationResult> {
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

  if (!(await ensurePermission('location', opts))) {
    return { ok: false, reason: 'permission_denied', message: '' };
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
  const googleMaps = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      return false;
    }
  };

  void (async () => {
    if (Platform.OS === 'ios') {
      const iosUrl = `maps:0,0?q=${query}&ll=${latitude},${longitude}`;
      if (!(await open(iosUrl))) await open(googleMaps);
      return;
    }

    if (Platform.OS === 'android') {
      const geoUrl = `geo:0,0?q=${latitude},${longitude}(${query})`;
      if (!(await open(geoUrl))) await open(googleMaps);
      return;
    }

    await open(googleMaps);
  })();
}

export function openAppSettings() {
  void Linking.openSettings();
}
