import { VideoView, useVideoPlayer } from 'expo-video';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';

export function RecapVideoPreview({
  uri,
  slideCount,
  durationLabel,
  saving,
  onSave,
}: {
  uri: string;
  slideCount: number;
  durationLabel: string;
  saving: boolean;
  onSave: () => void;
}) {
  const { colors } = useTheme();
  const player = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.loop = true;
    playerInstance.play();
  });

  return (
    <View style={styles.previewWrap}>
      <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
      <View style={[styles.metaBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.metaText, { color: colors.text }]}>
          {slideCount} moment{slideCount === 1 ? '' : 's'} · {durationLabel}
        </Text>
        <Text style={[styles.metaHint, { color: colors.textSecondary }]}>
          Tap download to save to your gallery
        </Text>
      </View>
      <PrimaryButton
        label={saving ? 'Saving…' : 'Save recap video'}
        onPress={onSave}
        disabled={saving}
        style={styles.saveBtn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  previewWrap: { flex: 1, paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
  video: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  metaBar: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  metaText: { fontSize: 16, fontWeight: '800' },
  metaHint: { fontSize: 13 },
  saveBtn: { marginTop: 4 },
});
