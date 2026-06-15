import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

interface AttachmentOption {
  id: string;
  icon: IconName;
  label: string;
  color: string;
  bgColor: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onPickGallery: () => void;
  onPickCamera: () => void;
  onPickAudio: () => void;
}

export function ChatAttachmentSheet({
  visible,
  onClose,
  onPickGallery,
  onPickCamera,
  onPickAudio,
}: Props) {
  const { colors } = useTheme();

  const options: AttachmentOption[] = [
    { id: 'gallery', icon: 'image', label: 'Photo Library', color: colors.onAccent, bgColor: '#9B59B6' },
    { id: 'camera', icon: 'camera', label: 'Camera', color: '#fff', bgColor: '#2C3E50' },
    { id: 'audio', icon: 'mic', label: 'Voice Note', color: '#fff', bgColor: colors.accent },
  ];

  const handlePress = (id: string) => {
    onClose();
    // Small delay so sheet closes before permission dialogs appear
    setTimeout(() => {
      if (id === 'gallery') onPickGallery();
      else if (id === 'camera') onPickCamera();
      else if (id === 'audio') onPickAudio();
    }, 200);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]}
          onPress={() => undefined}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>Share</Text>

          <View style={styles.grid}>
            {options.map((opt) => (
              <Pressable
                key={opt.id}
                style={styles.optionWrap}
                onPress={() => handlePress(opt.id)}>
                <View style={[styles.optionIcon, { backgroundColor: opt.bgColor }]}>
                  <Icon name={opt.icon} size={28} color={opt.color} />
                </View>
                <Text style={[styles.optionLabel, { color: colors.textSecondary }]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={onClose}
            style={[styles.cancelBtn, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 20 },
  grid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  optionWrap: { alignItems: 'center', gap: 8, flex: 1 },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  cancelBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  cancelText: { fontSize: 17, fontWeight: '600' },
});
