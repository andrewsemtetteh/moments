import { useEffect, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  LocationMapPreview,
  type MapMarker,
} from "@/components/moments/LocationMapPreview";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/primitives";
import { ThemedStatusBar } from "@/components/ui/ThemedStatusBar";
import { useTheme } from "@/hooks/useTheme";
import * as Haptics from "@/lib/haptics";
import { openInMaps } from "@/lib/location";

const SCREEN_W = Dimensions.get("window").width;

interface Props {
  visible: boolean;
  markers: MapMarker[];
  title?: string | null;
  onClose: () => void;
  /**
   * Draw inside the current full-screen layer (the partner profile) instead of as its own
   * Modal: no hand-off between two layers, so closing it lands straight back on the profile.
   */
  inline?: boolean;
}

/**
 * The full map, like Find My / Snap Map / WhatsApp live location: drag, pinch and rotate
 * the map; tap a person's chip to fly to them; the target button fits everyone back in.
 * Like Moments history it slides in from the right and a swipe right closes it — from the
 * top bar, the chips, the bottom, or the thin strip along the map's left edge (the map
 * itself keeps its own drags).
 */
export function FullScreenLocationMapModal({
  visible,
  markers,
  title,
  onClose,
  inline = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const translateX = useSharedValue(SCREEN_W);

  useEffect(() => {
    if (visible) {
      translateX.set(SCREEN_W);
      translateX.set(
        withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) }),
      );
    }
    // translateX is a stable shared value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Closed: start fresh (everyone in view) next time.
  const handleClosed = () => {
    setFocusedIndex(null);
    onClose();
  };

  const animateClose = () => {
    translateX.set(
      withTiming(
        SCREEN_W,
        { duration: 240, easing: Easing.in(Easing.quad) },
        (done) => {
          if (done) runOnJS(handleClosed)();
        },
      ),
    );
  };

  // Swipe right to close, like Moments history; let go early and it springs back.
  const swipeClose = Gesture.Pan()
    .activeOffsetX(12)
    .failOffsetX(-8)
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      translateX.set(Math.max(0, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX > SCREEN_W * 0.3 || e.velocityX > 700) {
        translateX.set(
          withSpring(
            SCREEN_W,
            { damping: 30, stiffness: 260, velocity: e.velocityX },
            (done) => {
              if (done) runOnJS(handleClosed)();
            },
          ),
        );
        return;
      }
      translateX.set(withSpring(0, { damping: 30, stiffness: 260 }));
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!visible || markers.length === 0) return null;

  const centerLat =
    markers.reduce((sum, m) => sum + m.latitude, 0) / markers.length;
  const centerLng =
    markers.reduce((sum, m) => sum + m.longitude, 0) / markers.length;
  const subtitle =
    markers.length > 1
      ? markers
          .map((m) => m.label)
          .filter(Boolean)
          .join(" · ")
      : (markers[0].label ?? "Shared location");

  const openExternal = () => {
    const focus = focusedIndex != null ? markers[focusedIndex] : null;
    if (focus)
      openInMaps(
        focus.latitude,
        focus.longitude,
        focus.label ?? title ?? subtitle,
      );
    else openInMaps(centerLat, centerLng, title ?? subtitle);
  };

  const toggleFocus = (index: number) => {
    void Haptics.selectionAsync();
    setFocusedIndex((current) => (current === index ? null : index));
  };

  const recenter = () => {
    void Haptics.selectionAsync();
    setFocusedIndex(null);
    setRecenterKey((k) => k + 1);
  };

  const sheet = (
    <GestureDetector gesture={swipeClose}>
      <Animated.View
        style={[
          styles.root,
          { backgroundColor: colors.background },
          sheetStyle,
        ]}
      >
        <View style={{ paddingTop: insets.top }}>
          <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
            <View style={styles.titleWrap}>
              <Text
                style={[styles.title, { color: colors.text }]}
                numberOfLines={1}
              >
                {title || "Locations"}
              </Text>
            </View>
            <Pressable
              onPress={animateClose}
              hitSlop={12}
              style={styles.iconBtn}
              accessibilityLabel="Close map"
            >
              <Icon name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {markers.length > 1 && (
            <View style={styles.tagsRow}>
              {markers.map((m, index) => {
                const active = focusedIndex === index;
                const tint = m.color ?? colors.accent;
                const name = m.name?.trim() || m.label?.trim() || "Location";
                return (
                  <Pressable
                    key={`${m.latitude}-${m.longitude}-${index}`}
                    onPress={() => toggleFocus(index)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.tag,
                      {
                        backgroundColor: active
                          ? `${tint}1F`
                          : colors.surfaceElevated,
                        borderColor: active ? tint : colors.border,
                      },
                    ]}
                  >
                    <View style={[styles.tagAvatarRing, { borderColor: tint }]}>
                      <Avatar
                        name={name}
                        imageUrl={m.avatarUrl}
                        size={20}
                        colorsOverride={["#ffffff", "#ffffff"]}
                        initialColor={tint}
                      />
                    </View>
                    <Text
                      style={[styles.tagText, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.mapWrap}>
          <LocationMapPreview
            markers={markers}
            interactive
            focusedIndex={focusedIndex}
            recenterKey={recenterKey}
            onMarkerPress={toggleFocus}
            style={styles.map}
          />
          {/* A thin strip along the map's left edge where the swipe-back can start. */}
          <View style={styles.edgeStrip} />
          <Pressable
            onPress={recenter}
            accessibilityRole="button"
            accessibilityLabel="Show everyone"
            style={({ pressed }) => [
              styles.recenter,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Icon name="target" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            onPress={openExternal}
            style={[styles.openBtn, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Open in maps app"
          >
            <Icon name="location" size={18} color={colors.onAccent} />
            <Text style={[styles.openBtnText, { color: colors.onAccent }]}>
              Open in Maps
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );

  if (inline) return <View style={StyleSheet.absoluteFill}>{sheet}</View>;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={animateClose}
    >
      <ThemedStatusBar />
      <GestureHandlerRootView style={styles.flex}>
        {sheet}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  titleWrap: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: "800" },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tagAvatarRing: { padding: 1.5, borderRadius: 999, borderWidth: 1.5 },
  tagText: { fontSize: 13, fontWeight: "700", maxWidth: 120 },
  mapWrap: { flex: 1, paddingHorizontal: 12, paddingTop: 12 },
  map: { flex: 1, height: undefined, borderRadius: 18 },
  edgeStrip: { position: "absolute", left: 0, top: 12, bottom: 0, width: 24 },
  recenter: {
    position: "absolute",
    right: 24,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  openBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  openBtnText: { fontSize: 15, fontWeight: "700" },
});
