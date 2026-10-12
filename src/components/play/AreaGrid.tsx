import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { AREAS, areaItemCount } from '@/lib/handpicked';

import { PlayCard } from './PlayCard';

/** The nine Handpicked areas as a two-column grid of gradient cards. */
export function AreaGrid() {
  const router = useRouter();
  return (
    <View style={styles.grid}>
      {AREAS.map((area) => (
        <View key={area.id} style={styles.cell}>
          <PlayCard
            layout="tile"
            tone={PLAY_TONES[area.tone]}
            badge={`${areaItemCount(area.id)} to try`}
            title={area.title}
            cta="Explore"
            onPress={() => router.push({ pathname: '/play/area/[id]', params: { id: area.id } })}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  cell: { width: '48.4%' },
});
