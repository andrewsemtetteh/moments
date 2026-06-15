import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

const HEADER_SIDE_WIDTH = 72;

interface LegalScreenProps {
  title: string;
  children: string;
}

export function LegalScreen({ title, children }: LegalScreenProps) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={8}
            accessibilityLabel="Go back"
            accessibilityRole="button">
            <Icon name="chevronLeft" size={18} color={colors.accent} />
            <Text style={[styles.backLabel, { color: colors.accent }]}>Back</Text>
          </Pressable>
        </View>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerSide} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.body, { color: colors.text }]}>{children}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  headerSide: { width: HEADER_SIDE_WIDTH },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: -4,
  },
  backLabel: { fontSize: 17, fontWeight: '600', lineHeight: 20 },
  headerTitle: { fontSize: 18, fontWeight: '800', flexShrink: 1, textAlign: 'center' },
  content: { padding: 24, paddingBottom: 48 },
  body: { fontSize: 15, lineHeight: 24 },
});
