import { formatDistanceToNowStrict } from 'date-fns';
import { useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LocationMapPreview, type MapMarker } from '@/components/moments/LocationMapPreview';
import { MomentSquircle } from '@/components/moments/MomentSquircle';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import type { MomentPlace } from '@/lib/moment-places';
import { momentChrome } from '@/lib/moment-theme';

const SCREEN_H = Dimensions.get('window').height;

export function placeTitle(place: MomentPlace) {
  if (place.name) return `${place.name.emoji} ${place.name.name}`;
  return place.suggestion?.split(',')[0]?.trim() || 'Unnamed place';
}

/** Entry card at the top of Moment history. */
export function OurMapCard({
  places,
  onOpen,
}: {
  places: MomentPlace[];
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  const pinned = places.reduce((n, p) => n + p.moments.length, 0);

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel="Open our map"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: chrome.surfaceSoft, borderColor: chrome.border },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.cardIcon, { backgroundColor: chrome.accentSoft }]}>
        <Icon name="map" size={22} color={chrome.accent} />
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: chrome.text }]}>Our map</Text>
        <Text style={[styles.cardSub, { color: chrome.textSecondary }]} numberOfLines={1}>
          {places.length > 0
            ? `${places.length} place${places.length === 1 ? '' : 's'} · ${pinned} moment${pinned === 1 ? '' : 's'}`
            : 'See your moments where they happened'}
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={chrome.textTertiary} />
    </Pressable>
  );
}

/** The map, with the couple's places listed under it. */
export function OurMapView({
  places,
  bottomInset,
  onOpenPlace,
  onNamePlace,
}: {
  places: MomentPlace[];
  bottomInset: number;
  onOpenPlace: (place: MomentPlace) => void;
  onNamePlace: (place: MomentPlace) => void;
}) {
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const markers = useMemo<MapMarker[]>(
    () =>
      places.map((p) => {
        const cover = p.moments.find((m) => m.type === 'photo' && m.media_url);
        return {
          latitude: p.latitude,
          longitude: p.longitude,
          label: `${placeTitle(p)} · ${p.moments.length}`,
          name: p.name?.emoji ?? placeTitle(p),
          avatarUrl: cover?.media_url ?? null,
          color: colors.accent,
        };
      }),
    [places, colors.accent],
  );

  const focusedIndex = focusedKey ? places.findIndex((p) => p.key === focusedKey) : -1;

  if (places.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: chrome.accentSoft }]}>
          <Icon name="map" size={34} color={chrome.accent} />
        </View>
        <Text style={[styles.emptyTitle, { color: chrome.text }]}>No pins yet</Text>
        <Text style={[styles.emptySub, { color: chrome.textSecondary }]}>
          Turn on “Add location” when you send a moment, and it lands here — the café, a trip, home.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + 24 }]}
      showsVerticalScrollIndicator={false}>
      <LocationMapPreview
        markers={markers}
        interactive
        height={Math.round(SCREEN_H * 0.42)}
        focusedIndex={focusedIndex >= 0 ? focusedIndex : null}
        onMarkerPress={(i) => {
          const place = places[i];
          if (place) setFocusedKey(place.key);
        }}
        style={styles.map}
      />

      <View style={styles.listHeader}>
        <Text style={[styles.listTitle, { color: chrome.text }]}>Places</Text>
        <Text style={[styles.listCount, { color: chrome.textTertiary }]}>{places.length}</Text>
      </View>

      {places.map((place) => {
        const focused = place.key === focusedKey;
        const last = place.moments[0];
        return (
          <Pressable
            key={place.key}
            onPress={() => {
              if (focused) onOpenPlace(place);
              else setFocusedKey(place.key);
            }}
            accessibilityRole="button"
            accessibilityHint={focused ? 'Opens the moments from here' : 'Shows it on the map'}
            style={({ pressed }) => [
              styles.row,
              focused && { backgroundColor: chrome.surfaceSoft },
              pressed && styles.pressed,
            ]}>
            <View pointerEvents="none">
              <MomentSquircle moment={last} size={56} showAuthor={false} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: chrome.text }]} numberOfLines={1}>
                {placeTitle(place)}
              </Text>
              <Text style={[styles.rowSub, { color: chrome.textTertiary }]} numberOfLines={1}>
                {place.moments.length} moment{place.moments.length === 1 ? '' : 's'} ·{' '}
                {formatDistanceToNowStrict(new Date(last.created_at), { addSuffix: true })}
              </Text>
              {focused ? (
                <Text style={[styles.rowHint, { color: chrome.accent }]}>Tap again to see them</Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => onNamePlace(place)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={place.name ? `Rename ${place.name.name}` : 'Name this place'}
              style={[styles.nameBtn, { backgroundColor: place.name ? 'transparent' : chrome.accentSoft }]}>
              {place.name ? (
                <Icon name="edit" size={18} color={chrome.textSecondary} />
              ) : (
                <Text style={[styles.nameBtnText, { color: chrome.accent }]}>Name it</Text>
              )}
            </Pressable>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 22,
  },
  cardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardSub: { fontSize: 13 },
  scroll: { paddingHorizontal: 12 },
  map: { borderRadius: 24 },
  listHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 22, marginBottom: 8 },
  listTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  listCount: { fontSize: 14, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 18,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowSub: { fontSize: 13, fontWeight: '600' },
  rowHint: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  nameBtn: { minWidth: 44, height: 34, borderRadius: 17, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  nameBtnText: { fontSize: 13, fontWeight: '800' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 36, paddingBottom: 80 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySub: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
