import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FullScreenPage } from '@/components/layout/FullScreenPage';
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

/**
 * Every activity, game, conversation and quiz opens as a full page like the rest of the
 * app (slides in from the right, back arrow, swipe right to go back) — not a pull-down
 * sheet. The coloured card at the top says what it is; the activity runs below it.
 */
export function ExploreModalShell({ visible, meta, onClose, children }: ExploreModalShellProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <FullScreenPage visible={visible} title="" onBack={onClose} avoidKeyboard={false} dismissKeyboardOnTap={false}>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={[styles.heroGlow, { backgroundColor: colorWithAlpha(colors.onAccent, 0.12) }]} pointerEvents="none" />
          <Text style={styles.heroEmoji}>{meta.emoji}</Text>
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

        {children}
      </ScrollView>
    </FullScreenPage>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingTop: 4, gap: 16 },
  hero: { borderRadius: 24, padding: 18, overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 140, height: 140, borderRadius: 70, top: -40, right: -20 },
  heroEmoji: { position: 'absolute', top: 12, right: 18, fontSize: 44, opacity: 0.22 },
  heroCopy: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  heroText: { flex: 1, gap: 2 },
  heroEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  heroSub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
