import * as Haptics from '@/lib/haptics';
import { useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

import { LocationMapPreview, type MapMarker } from '@/components/moments/LocationMapPreview';
import { MomentThumbImage } from '@/components/moments/MomentThumbImage';
import { Icon } from '@/components/ui/Icon';
import { outlineColor, colorWithAlpha } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import type { MomentPlace } from '@/lib/moment-places';

const CARD_W = 236;
const CARD_GAP = 10;

/**
 * Our map, full screen (Snap Map style): the cartoon map edge to edge, a close button and
 * the title floating on top, and your places as a row of cards along the bottom. Swipe the
 * cards and the map flies to each place; tap a pin and its card comes into view; tap a
 * card again to open the place's moments.
 */
export function OurMapFullScreen({
  visible,
  places,
  markers,
  title,
  onClose,
  onOpenPlace,
}: {
  visible: boolean;
  places: MomentPlace[];
  markers: MapMarker[];
  title: (place: MomentPlace) => string;
  onClose: () => void;
  onOpenPlace: (place: MomentPlace) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const [focused, setFocused] = useState<number | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const list = useRef<FlatList<MomentPlace>>(null);

  if (!visible || places.length === 0) return null;

  // Closed: next time it opens on every place again.
  const close = () => {
    setFocused(null);
    onClose();
  };

  const focusPlace = (i: number, scroll: boolean) => {
    void Haptics.selectionAsync();
    setFocused(i);
    if (scroll) list.current?.scrollToIndex({ index: i, animated: true, viewPosition: 0.5 });
  };
  const everyone = () => {
    void Haptics.selectionAsync();
    setFocused(null);
    setRecenterKey((k) => k + 1);
  };

  const cardBg = colors.isDark ? colors.surface : colors.surfaceElevated;
  const chipBg = colors.isDark ? 'rgba(20,20,26,0.86)' : 'rgba(255,255,255,0.94)';

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={close}>
      <StatusBar style={colors.isDark ? 'light' : 'dark'} />
      <GestureHandlerRootView style={styles.root}>
        {/* The map, edge to edge. */}
        <LocationMapPreview
          markers={markers}
          interactive
          focusedIndex={focused}
          recenterKey={recenterKey}
          onMarkerPress={(i) => focusPlace(i, true)}
          style={styles.map}
        />

        {/* The clock and battery sit over busy map tiles: a soft fade in the page colour keeps them clear. */}
        <LinearGradient
          pointerEvents="none"
          colors={[colorWithAlpha(colors.background, 0.92), colorWithAlpha(colors.background, 0)]}
          style={[styles.statusFade, { height: insets.top + 64 }]}
        />

        {/* Top: close (left), the title (centre), everyone in view (right). */}
        <View style={[styles.top, { top: insets.top + 8 }]} pointerEvents="box-none">
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close map"
            style={({ pressed }) => [styles.round, { backgroundColor: chipBg, borderColor: outlineColor(colors) }, pressed && styles.pressed]}>
            <Icon name="close" size={22} color={colors.text} />
          </Pressable>
          <View style={[styles.titlePill, { backgroundColor: chipBg, borderColor: outlineColor(colors) }]}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              Our map
            </Text>
            <Text style={[styles.count, { color: colors.textSecondary }]}>
              {places.length} {places.length === 1 ? 'place' : 'places'}
            </Text>
          </View>
          <Pressable
            onPress={everyone}
            accessibilityRole="button"
            accessibilityLabel="Show every place"
            style={({ pressed }) => [styles.round, { backgroundColor: chipBg, borderColor: outlineColor(colors) }, pressed && styles.pressed]}>
            <Icon name="target" size={20} color={colors.text} />
          </Pressable>
        </View>

        {/* Bottom: your places as cards. */}
        <FlatList
          ref={list}
          data={places}
          horizontal
          alwaysBounceHorizontal={false}
          keyExtractor={(p) => p.key}
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_W + CARD_GAP}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: (width - CARD_W) / 2, gap: CARD_GAP }}
          style={[styles.cards, { bottom: insets.bottom + 16 }]}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + CARD_GAP));
            if (i >= 0 && i < places.length && i !== focused) setFocused(i);
          }}
          onScrollToIndexFailed={() => undefined}
          getItemLayout={(_, i) => ({ length: CARD_W + CARD_GAP, offset: (CARD_W + CARD_GAP) * i, index: i })}
          renderItem={({ item, index }) => {
            const on = index === focused;
            const cover = item.moments.find((m) => m.media_url && (m.type === 'photo' || m.type === 'video'));
            return (
              <Pressable
                onPress={() => (on ? onOpenPlace(item) : focusPlace(index, true))}
                accessibilityRole="button"
                accessibilityLabel={`${title(item)}, ${item.moments.length} moments`}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: cardBg,
                    borderColor: on ? colors.accent : outlineColor(colors),
                    borderWidth: on ? 2 : colors.boldBorder ? 2 : 1,
                  },
                  pressed && styles.pressed,
                ]}>
                {cover ? (
                  <MomentThumbImage moment={cover} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.accentSoft }]}>
                    <Icon name="pin" size={20} color={colors.accent} />
                  </View>
                )}
                <View style={styles.cardText}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                    {title(item)}
                  </Text>
                  <Text style={[styles.cardSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.moments.length} {item.moments.length === 1 ? 'moment' : 'moments'}
                    {on ? ' · Tap to open' : ''}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  statusFade: { position: 'absolute', top: 0, left: 0, right: 0 },
  root: { flex: 1 },
  // flex: the preview fills the screen (it reads flex as "fill"), square and borderless.
  map: { flex: 1, borderRadius: 0, borderWidth: 0 },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  titlePill: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  title: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  count: { fontSize: 13, fontWeight: '700' },
  cards: { position: 'absolute', left: 0, right: 0, flexGrow: 0 },
  card: {
    width: CARD_W,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  thumb: { width: 52, height: 52, borderRadius: 14 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardSub: { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  pressed: { opacity: 0.85 },
});
