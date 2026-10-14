import * as Haptics from '@/lib/haptics';
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { shareViewAsImage } from '@/lib/share-image';

/**
 * Preview a shareable card, then share it or save it to Photos as an image. The card is exactly what
 * gets saved (nothing around it, square corners).
 *
 * `inline` draws it as an overlay instead of its own Modal: use it when the caller is already inside
 * a Modal (like Wrapped), because the share sheet won't open over two stacked modals on iOS.
 */
export function ShareCardModal({
  visible,
  onClose,
  title,
  children,
  inline = false,
  captureFrom,
}: {
  visible: boolean;
  onClose: () => void;
  /** Share sheet title (Android) / accessibility. */
  title: string;
  /** The card itself; give it a fixed size and its own background. */
  children: ReactNode;
  inline?: boolean;
  /**
   * Capture this view instead of the preview: for a card drawn full size and only
   * shrunk to fit the preview, so the saved image keeps its full resolution.
   */
  captureFrom?: RefObject<View | null>;
}) {
  const insets = useSafeAreaInsets();
  const cardRef = useRef<View>(null);
  // Share opens the phone's share sheet, which already has "Save Image": one button is enough.
  const [busy, setBusy] = useState<'share' | null>(null);

  const share = async () => {
    if (busy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy('share');
    // Same as the version that worked: capture and share while the preview stays open.
    await shareViewAsImage(captureFrom ?? cardRef, { title });
    setBusy(null);
  };

  const content = (
    <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
      <View style={[styles.stage, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        {/* Rounded only on screen; the captured view inside is a plain rectangle. */}
        <Pressable onPress={() => undefined} style={styles.cardWrap}>
          <View ref={cardRef} collapsable={false}>
            {children}
          </View>
        </Pressable>

        <View style={styles.buttons}>
          <View style={styles.row}>
            <Pressable
              onPress={() => void share()}
              disabled={!!busy}
              accessibilityRole="button"
              accessibilityLabel="Share image"
              style={({ pressed }) => [styles.mainBtn, pressed && styles.pressed]}>
              {busy === 'share' ? (
                <ActivityIndicator color="#1A1A1A" />
              ) : (
                <Icon name="share" size={18} color="#1A1A1A" />
              )}
              <Text style={styles.mainText}>Share</Text>
            </Pressable>
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" style={styles.closeBtn}>
            <Text style={styles.closeText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  if (inline) {
    return visible ? <View style={StyleSheet.absoluteFill}>{content}</View> : null;
  }
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, paddingHorizontal: 24 },
  cardWrap: { borderRadius: 24, overflow: 'hidden' },
  buttons: { alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mainBtn: {
    height: 54,
    paddingHorizontal: 30,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mainText: { color: '#1A1A1A', fontSize: 16, fontWeight: '900' },
  closeBtn: { height: 36, justifyContent: 'center', paddingHorizontal: 10 },
  closeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
