import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { usePartnerLocationRealtime } from '@/hooks/useSharedLocationMap';
import { haversineDistanceKm } from '@/lib/distance';
import { formatPlace, hasLocationPermission } from '@/lib/location';
import { fetchPartnerProfileRow } from '@/lib/partner-location';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';

/** Save to the server after moving this far… */
const SAVE_AFTER_KM = 0.15;
/** …or this long since the last save, whichever comes first. */
const SAVE_AFTER_MS = 3 * 60_000;

/**
 * Keeps "how far apart" live everywhere in the app (the header, Home, the
 * partner profile), not only on the screens that happen to show a map.
 *
 * - Your side: while the app is open and you share location (permission
 *   already granted; this never asks), the phone's location watcher follows
 *   you. The distance on screen updates as you move; the server is only told
 *   after you've moved ~150 m or every few minutes, to go easy on battery and data.
 * - Their side: a live subscription to your partner's location, refreshed
 *   whenever the app comes back to the front.
 * - In the background everything stops.
 */
export function LiveLocationSync() {
  usePartnerLocationRealtime();

  // Coming back to the app: catch up on where they are (the live channel may have slept).
  const partnerId = useRelationshipStore((s) => s.partner?.id);
  useEffect(() => {
    if (!partnerId) return;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      void fetchPartnerProfileRow(partnerId)
        .then((row) => {
          if (row) useRelationshipStore.getState().setPartner(row);
        })
        .catch(() => undefined);
    });
    return () => sub.remove();
  }, [partnerId]);

  const userId = useAuthStore((s) => s.user?.id);
  const sharing = useAuthStore((s) => !!s.user?.location_sharing_enabled);
  const lastSaved = useRef<{ lat: number; lng: number; at: number } | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' || !userId || !sharing) return;
    let watcher: Location.LocationSubscription | null = null;
    let cancelled = false;

    const save = async (lat: number, lng: number) => {
      lastSaved.current = { lat, lng, at: Date.now() };
      let label = useAuthStore.getState().user?.location_label ?? '';
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        label = formatPlace(place) ?? label;
      } catch {
        // Keep the last label.
      }
      try {
        const updated = await api.updateLocationSharing(userId, true, { latitude: lat, longitude: lng, label });
        const current = useAuthStore.getState().user;
        if (current) useAuthStore.getState().setUser({ ...current, ...updated });
      } catch {
        // Offline: try again on the next move.
        lastSaved.current = null;
      }
    };

    const onPosition = (pos: Location.LocationObject) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      // Show it right away on this phone.
      const current = useAuthStore.getState().user;
      if (current) {
        useAuthStore.getState().setUser({ ...current, location_latitude: lat, location_longitude: lng });
      }
      const last = lastSaved.current;
      const moved = last ? haversineDistanceKm({ latitude: last.lat, longitude: last.lng }, { latitude: lat, longitude: lng }) : Infinity;
      if (!last || moved >= SAVE_AFTER_KM || Date.now() - last.at >= SAVE_AFTER_MS) void save(lat, lng);
    };

    const start = async () => {
      if (watcher || !(await hasLocationPermission()) || cancelled) return;
      watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 40, timeInterval: 20_000 },
        onPosition,
      ).catch(() => null);
      if (cancelled) {
        watcher?.remove();
        watcher = null;
      }
    };
    const stop = () => {
      watcher?.remove();
      watcher = null;
    };

    if (AppState.currentState === 'active') void start();
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void start();
      else stop();
    });

    return () => {
      cancelled = true;
      stop();
      sub.remove();
    };
  }, [userId, sharing]);

  return null;
}
