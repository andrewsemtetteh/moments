import { StyleSheet, Text, View } from 'react-native';

import { PLAY_TONES, type ExploreModalKey } from '@/components/activities/explore/explore-catalog';
import { ChunkyButton } from '@/components/games/room-ui';
import { DraggableSheet } from '@/components/ui/DraggableSheet';
import { useTheme } from '@/hooks/useTheme';
import { getGameDefinition, type LiveGameKind } from '@/lib/game-room/types';

interface Props {
  /** The live game being offered, or null when the sheet is closed. */
  game: LiveGameKind | null;
  onClose: () => void;
  onLive: (game: LiveGameKind) => void;
  onLocal: () => void;
  localLabel?: string;
  activityKey?: ExploreModalKey | null;
}

/** Choose between the live two-phone room (with voice) and the classic on-this-phone version. */
export function PlayModeSheet({ game, onClose, onLive, onLocal, localLabel }: Props) {
  const { colors } = useTheme();
  const def = game ? getGameDefinition(game) : null;
  const tone = def ? PLAY_TONES[def.tone] : null;

  return (
    <DraggableSheet visible={!!game} onClose={onClose}>
      {def && tone ? (
        <View style={styles.wrap}>
          <Text style={styles.emoji}>{def.emoji}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{def.title}</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>How do you want to play?</Text>

          <View style={styles.options}>
            <ChunkyButton
              label="🎧  Live together with voice"
              color={tone.accent}
              onPress={() => onLive(def.kind)}
            />
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              Two phones, one room. Talk while you play — AI writes every round. Earn up to 140 XP.
            </Text>
            <ChunkyButton
              label={localLabel ?? '📱  On this phone'}
              compact
              color={colors.textTertiary}
              onPress={onLocal}
            />
          </View>
        </View>
      ) : null}
    </DraggableSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4, paddingBottom: 8 },
  emoji: { fontSize: 46 },
  title: { fontSize: 22, fontWeight: '900' },
  sub: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  options: { alignSelf: 'stretch', gap: 10 },
  hint: { fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 17, marginBottom: 6 },
});
