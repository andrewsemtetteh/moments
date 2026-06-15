import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import { useRelationshipStore } from '@/stores';

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          Welcome to {relationship?.relationship_name ?? 'Moments'}
        </Text>
        {partner && (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            You and {partner.name} are now connected
          </Text>
        )}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.prompt, { color: colors.text }]}>
            Send your first moment or message to start your streak.
          </Text>
        </View>

        <Pressable
          style={[styles.btn, { backgroundColor: colors.accent }]}
          onPress={() => router.replace('/(tabs)/home')}>
          <Text style={styles.btnText}>Enter Our Space</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 16 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center' },
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginVertical: 24,
    width: '100%',
  },
  prompt: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  btn: { padding: 16, borderRadius: 28, alignItems: 'center', width: '100%' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
