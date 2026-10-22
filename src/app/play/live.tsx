import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { firstName } from '@/components/games/room-ui';
import { GameGroups } from '@/components/play/GameList';
import { PlayHeader } from '@/components/play/PlayHeader';
import { PLAY_GUTTER, PlayHero } from '@/components/play/PlayKit';
import { useLightStatusBar } from '@/hooks/useLightStatusBar';
import { useTheme } from '@/hooks/useTheme';
import { useRelationshipStore } from '@/stores';

const tone = PLAY_TONES.rose;

/**
 * Go live: the games, as the same cards as Endless. Tapping one opens that game's page set to a live
 * session, where you choose the vibe and rounds and start it (your partner is invited to join).
 */
export default function GoLiveScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  useLightStatusBar();
  const partner = useRelationshipStore((s) => s.partner);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        bounces={false}
        overScrollMode="never"
        stickyHeaderIndices={[0]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: tone.accent }}>
          <PlayHeader title="Play live" onColor="#FFFFFF" />
        </View>
        <PlayHero
          color={tone.accent}
          pill="Live · with voice"
          blurb={`Pick a game to play together right now. We’ll invite ${firstName(partner?.name)} to join you.`}
        />
        <View style={styles.body}>
          <GameGroups live />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: PLAY_GUTTER, paddingTop: 8 },
});
