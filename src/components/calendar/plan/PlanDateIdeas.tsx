import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DATE_IDEAS, type DateIdea } from '@/constants/date-ideas';
import { useTheme } from '@/hooks/useTheme';

export function PlanDateIdeas({ onAdd }: { onAdd: (idea: DateIdea) => void }) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.text }]}>Date Ideas</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {DATE_IDEAS.map((idea) => (
          <View key={idea.id} style={[styles.card, { shadowColor: colors.shadow }]}>
            <Image source={{ uri: idea.image }} style={styles.image} contentFit="cover" transition={200} />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={StyleSheet.absoluteFill} />
            <View style={styles.body}>
              <Text style={styles.title}>{idea.title}</Text>
              <Text style={styles.meta}>
                {idea.cost} · {idea.duration} · {idea.weather}
              </Text>
              <Pressable
                onPress={() => onAdd(idea)}
                style={[styles.cta, { backgroundColor: 'rgba(255,255,255,0.92)' }]}>
                <Text style={{ color: '#1A1214', fontWeight: '800', fontSize: 13 }}>Add to Plan</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  heading: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, paddingHorizontal: 20 },
  row: { paddingHorizontal: 20, gap: 14 },
  card: {
    width: 220,
    height: 280,
    borderRadius: 28,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  image: { ...StyleSheet.absoluteFill },
  body: { flex: 1, justifyContent: 'flex-end', padding: 16, gap: 6 },
  title: { color: '#FFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  meta: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  cta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
});
