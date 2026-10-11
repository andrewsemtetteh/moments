import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useRelationshipStore } from '@/stores';
import type { Moment } from '@/types/database';

/**
 * "Our map": moments pinned where they were taken, grouped into places
 * ("The café", "Her hometown").
 *
 * The pins themselves live on the moment (latitude/longitude, shared with the
 * partner). The NAMES couples give places are stored on this device for now,
 * like albums (moment-albums.ts), until they get a backend table.
 */

export type PlaceName = { name: string; emoji: string };

export type MomentPlace = {
  key: string;
  latitude: number;
  longitude: number;
  /** Newest first. */
  moments: Moment[];
  name: PlaceName | null;
  /** City / street from the phone, used until the couple names the place. */
  suggestion: string | null;
};

export const PLACE_EMOJIS = ['📍', '☕', '🏡', '🍝', '🌊', '🏞️', '✈️', '💞', '🎡', '🌃'] as const;
export const PLACE_NAME_IDEAS = ['The café', 'Our spot', 'Home', 'Her hometown', 'His hometown', 'Our trip'] as const;

/** ~110 m grid: moments taken around the same spot become one place. */
export function placeKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

type PlacesStore = { names: Record<string, PlaceName>; suggestions: Record<string, string> };
const EMPTY: PlacesStore = { names: {}, suggestions: {} };

const storageKey = (relationshipId: string) => `moment-places:${relationshipId}`;
const queryKey = (relationshipId: string | undefined) => ['moment-places', relationshipId] as const;

async function loadPlaces(relationshipId: string): Promise<PlacesStore> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(relationshipId));
    const parsed = raw ? (JSON.parse(raw) as Partial<PlacesStore>) : {};
    return { names: parsed.names ?? {}, suggestions: parsed.suggestions ?? {} };
  } catch {
    return EMPTY;
  }
}

/** Remember where this phone reverse-geocoded a pin, for an unnamed place's subtitle. */
export async function rememberPlaceSuggestion(
  relationshipId: string,
  latitude: number,
  longitude: number,
  label: string | null,
) {
  if (!label) return;
  const current = await loadPlaces(relationshipId);
  const key = placeKey(latitude, longitude);
  if (current.suggestions[key]) return;
  const next = { ...current, suggestions: { ...current.suggestions, [key]: label } };
  await AsyncStorage.setItem(storageKey(relationshipId), JSON.stringify(next));
}

export function groupMomentsIntoPlaces(moments: Moment[], store: PlacesStore): MomentPlace[] {
  const byKey = new Map<string, MomentPlace>();
  for (const m of moments) {
    if (m.latitude == null || m.longitude == null) continue;
    const key = placeKey(m.latitude, m.longitude);
    const place = byKey.get(key);
    if (place) {
      place.moments.push(m);
    } else {
      byKey.set(key, {
        key,
        latitude: m.latitude,
        longitude: m.longitude,
        moments: [m],
        name: store.names[key] ?? null,
        suggestion: store.suggestions[key] ?? null,
      });
    }
  }
  // Most moments first — the places that matter most to the couple lead.
  return [...byKey.values()].sort((a, b) => b.moments.length - a.moments.length);
}

export function useMomentPlaces() {
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const queryClient = useQueryClient();

  const { data: store = EMPTY } = useQuery({
    queryKey: queryKey(relationshipId),
    queryFn: () => loadPlaces(relationshipId!),
    enabled: !!relationshipId,
  });

  const nameP = useCallback(
    (key: string, name: PlaceName) => {
      if (!relationshipId) return;
      const current = queryClient.getQueryData<PlacesStore>(queryKey(relationshipId)) ?? EMPTY;
      const next = { ...current, names: { ...current.names, [key]: { ...name, name: name.name.trim() } } };
      queryClient.setQueryData(queryKey(relationshipId), next);
      void AsyncStorage.setItem(storageKey(relationshipId), JSON.stringify(next));
    },
    [queryClient, relationshipId],
  );

  return { store, namePlace: nameP };
}
