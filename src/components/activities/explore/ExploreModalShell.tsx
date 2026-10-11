import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { colorWithAlpha } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';

import type { ExploreMeta } from './explore-meta';

interface ExploreModalShellProps {
  visible: boolean;
  meta: ExploreMeta;
  onClose: () => void;
  children: ReactNode;
}

export function ExploreModalShell({ visible, meta, onClose, children }: ExploreModalShellProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={[styles.heroGlow, { backgroundColor: colorWithAlpha(colors.onAccent, 0.12) }]} pointerEvents="none" />
          <Text style={styles.heroEmoji}>{meta.emoji}</Text>
          <View style={styles.heroTop}>
            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colorWithAlpha(colors.onAccent, 0.2) }]}
              hitSlop={8}>
              <Icon name="close" size={20} color={colors.onAccent} />
            </Pressable>
          </View>
          <View style={styles.heroCopy}>
            <View style={[styles.heroIcon, { backgroundColor: colorWithAlpha(colors.onAccent, 0.2) }]}>
              <Icon name={meta.icon} size={20} color={colors.onAccent} filled />
            </View>
            <View style={styles.heroText}>
              <Text style={[styles.heroEyebrow, { color: colorWithAlpha(colors.onAccent, 0.82) }]}>{meta.eyebrow}</Text>
              <Text style={[styles.heroTitle, { color: colors.onAccent }]}>{meta.title}</Text>
              <Text style={[styles.heroSub, { color: colorWithAlpha(colors.onAccent, 0.88) }]}>{meta.subtitle}</Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 22,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    top: -40,
    right: -20,
  },
  heroEmoji: {
    position: 'absolute',
    top: 10,
    right: 20,
    fontSize: 44,
    opacity: 0.22,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, gap: 2 },
  heroEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  heroSub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  body: { padding: 16, paddingBottom: 40, gap: 16 },
});
