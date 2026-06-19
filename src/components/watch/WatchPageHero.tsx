import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

export function WatchPageHero({
  eyebrow,
  title,
  subtitle,
  icon = 'film',
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon?: IconName;
}) {
  const { colors } = useTheme();

  return (
    <LinearGradient
      colors={colors.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}>
      <View style={styles.heroGlow} pointerEvents="none" />
      <View style={styles.heroRow}>
        <View style={styles.heroIcon}>
          <Icon name={icon} size={24} color="#fff" filled />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>{eyebrow}</Text>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroSub}>{subtitle}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

export const watchPanelStyles = StyleSheet.create({
  panel: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 14,
    marginTop: -18,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  fieldInput: {
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fieldGroup: { gap: 8 },
});

const styles = StyleSheet.create({
  hero: {
    borderRadius: 24,
    padding: 20,
    paddingBottom: 28,
    overflow: 'hidden',
    marginBottom: -18,
  },
  heroGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.12)',
    top: -50,
    right: -30,
  },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flex: 1, gap: 4 },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: 2,
  },
});
