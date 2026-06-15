import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';

interface Props {
  visible: boolean;
  imageUrl: string | null | undefined;
  title?: string | null;
  onClose: () => void;
}

export function FullScreenImageModal({ visible, imageUrl, title, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const uri = imageUrl?.trim() || null;

  if (!uri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close image" />

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
            accessibilityLabel="Close">
            <Icon name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        <View style={[styles.imageWrap, { paddingBottom: insets.bottom + 8 }]}>
          <Image source={{ uri }} style={styles.image} contentFit="contain" transition={200} />
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
    zIndex: 1,
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
  imageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
