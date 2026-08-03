import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { getAvatarInitial } from '@/lib/avatar-initial';

interface Props {
  visible: boolean;
  imageUrl: string | null | undefined;
  title?: string | null;
  fallbackName?: string | null;
  onClose: () => void;
}

/** Full-screen rectangular photo preview (not circular). */
export function FullScreenImageModal({ visible, imageUrl, title, fallbackName, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowW, height: windowH } = useWindowDimensions();
  const uri = imageUrl?.trim() || null;
  const showFallback = visible && !uri && !!fallbackName?.trim();

  if (!visible || (!uri && !showFallback)) return null;

  const topBarH = insets.top + 56;
  const bottomPad = insets.bottom + 12;
  const stageH = Math.max(0, windowH - topBarH - bottomPad);
  const side = Math.min(windowW - 32, stageH);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : (
            <View style={styles.titleSpacer} />
          )}
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <Icon name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        <View style={[styles.stage, { paddingBottom: bottomPad }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close image" />

          {uri ? (
            <Pressable onPress={() => {}} style={{ width: side, height: side }}>
              <Image source={{ uri }} style={styles.image} contentFit="contain" transition={200} />
            </Pressable>
          ) : (
            <Pressable onPress={() => {}}>
              <View style={[styles.fallback, { width: Math.min(side, 280) }]}>
                <Text style={styles.fallbackInitial}>{getAvatarInitial(fallbackName)}</Text>
              </View>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 2,
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginRight: 12,
  },
  titleSpacer: { flex: 1 },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackInitial: {
    color: '#fff',
    fontSize: 96,
    fontWeight: '700',
  },
});
