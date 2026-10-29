import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Icon } from '@/components/ui/Icon';
import { mediaSource } from '@/lib/storage-cdn';

/**
 * Photos in full screen, on black: the whole photo (nothing cropped), swipe sideways
 * through them, ✕ (top right) or a swipe down to close, as on an opened moment.
 * Opens on the one you tapped.
 */
export function PhotoViewerModal({
  photos,
  startIndex,
  onClose,
}: {
  /** Null: closed. */
  photos: string[] | null;
  startIndex: number;
  onClose: () => void;
}) {
  if (!photos?.length) return null;
  return <Viewer key={`${startIndex}-${photos.length}`} photos={photos} startIndex={startIndex} onClose={onClose} />;
}

function Viewer({ photos, startIndex, onClose }: { photos: string[]; startIndex: number; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(startIndex);

  // Swipe down to close: the photo follows the finger and the black fades; let go far or fast
  // enough and it carries on down and closes, otherwise it springs back.
  const dragY = useSharedValue(0);
  const swipeDown = Gesture.Pan()
    .activeOffsetY(14)
    .failOffsetY(-14)
    .failOffsetX([-14, 14])
    .onUpdate((e) => {
      dragY.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > height * 0.16 || e.velocityY > 900) {
        dragY.set(
          withTiming(height, { duration: 200 }, (done) => {
            if (done) runOnJS(onClose)();
          }),
        );
        return;
      }
      dragY.set(withSpring(0, { damping: 26, stiffness: 300 }));
    });
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragY.value, [0, height * 0.4], [1, 0], 'clamp'),
  }));
  const photoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: dragY.value },
      { scale: interpolate(dragY.value, [0, height * 0.5], [1, 0.86], 'clamp') },
    ],
  }));
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragY.value, [0, 80], [1, 0], 'clamp'),
  }));

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar style="light" />
      <GestureHandlerRootView style={styles.flex}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.root, backdropStyle]} />
      <GestureDetector gesture={swipeDown}>
      <Animated.View style={[styles.flex, photoStyle]}>
        <ScrollView
          horizontal
          alwaysBounceHorizontal={false}
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: startIndex * width, y: 0 }}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
          {photos.map((uri) => (
            <Image key={uri} source={mediaSource(uri)} style={{ width, height }} contentFit="contain" />
          ))}
        </ScrollView>
      </Animated.View>
      </GestureDetector>

        <Animated.View style={[styles.top, { paddingTop: insets.top + 8 }, chromeStyle]} pointerEvents="box-none">
          {photos.length > 1 ? (
            <View style={styles.count}>
              <Text style={styles.countText}>
                {page + 1} / {photos.length}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
            <Icon name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { backgroundColor: '#000000' },
  top: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  count: { paddingHorizontal: 12, height: 30, borderRadius: 15, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  countText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
