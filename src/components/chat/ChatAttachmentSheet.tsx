import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

export type AttachmentOptionId = 'gallery' | 'file' | 'contact' | 'location';

interface AttachmentOption {
  id: AttachmentOptionId;
  icon: IconName;
  label: string;
  tint: string;
}

interface Props {
  onClose: () => void;
  onPickGallery: () => void;
  onPickFile: () => void;
  onPickContact: () => void;
  onPickLocation: () => void;
}

const OPTIONS: Omit<AttachmentOption, 'tint'>[] = [
  { id: 'gallery', icon: 'image', label: 'Gallery' },
  { id: 'file', icon: 'document', label: 'File' },
  { id: 'contact', icon: 'user', label: 'Contact' },
  { id: 'location', icon: 'location', label: 'Location' },
];

const TINTS: Record<AttachmentOptionId, string> = {
  gallery: '#BF59CF',
  file: '#5F6CEF',
  contact: '#0FABDB',
  location: '#34C759',
};

/** Four attachment options in one row above the composer. */
export function ChatAttachmentSheet({
  onClose,
  onPickGallery,
  onPickFile,
  onPickContact,
  onPickLocation,
}: Props) {
  const { colors } = useTheme();

  const options: AttachmentOption[] = OPTIONS.map((opt) => ({
    ...opt,
    tint: TINTS[opt.id],
  }));

  const handlers: Record<AttachmentOptionId, () => void> = {
    gallery: onPickGallery,
    file: onPickFile,
    contact: onPickContact,
    location: onPickLocation,
  };

  const handlePress = (id: AttachmentOptionId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    setTimeout(() => handlers[id](), 180);
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
        },
      ]}>
      <View style={styles.row}>
        {options.map((opt) => (
          <Pressable
            key={opt.id}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            onPress={() => handlePress(opt.id)}>
            <View style={[styles.circle, { backgroundColor: opt.tint }]}>
              <Icon name={opt.icon} size={24} color="#FFFFFF" filled={opt.id === 'location'} />
            </View>
            <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 112,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minWidth: 0,
  },
  itemPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.94 }],
  },
  circle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
