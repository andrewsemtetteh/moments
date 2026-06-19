import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
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
          <View style={styles.heroGlow} pointerEvents="none" />
          <Text style={styles.heroEmoji}>{meta.emoji}</Text>
          <View style={styles.heroTop}>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Icon name="close" size={20} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.heroCopy}>
            <View style={styles.heroIcon}>
              <Icon name={meta.icon} size={20} color="#fff" filled />
            </View>
            <View style={styles.heroText}>
              <Text style={styles.heroEyebrow}>{meta.eyebrow}</Text>
              <Text style={styles.heroTitle}>{meta.title}</Text>
              <Text style={styles.heroSub}>{meta.subtitle}</Text>
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
    backgroundColor: 'rgba(255,255,255,0.12)',
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
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, gap: 2 },
  heroEyebrow: { color: 'rgba(255,255,255,0.82)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 18, marginTop: 2 },
  body: { padding: 16, paddingBottom: 40, gap: 16 },
});
