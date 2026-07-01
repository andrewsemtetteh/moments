import * as Haptics from 'expo-haptics';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import {
    createRecapVideoFromMoments,
    getRecapVideoDurationSeconds,
    type RecapVideoProgress,
} from '@/lib/create-recap-video';
import { saveLocalMomentMedia } from '@/lib/download-moment-media';
import { useUIStore } from '@/stores';

const RecapVideoPreview = lazy(() =>
  import('@/components/moments/RecapVideoPreview').then((module) => ({
    default: module.RecapVideoPreview,
  })),
);

type RecapPhase = 'generating' | 'ready' | 'error';

export function MomentRecapVideoModal() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const visible = useUIStore((s) => s.showMomentRecapVideo);
  const moments = useUIStore((s) => s.recapVideoMoments);
  const closeMomentRecapVideo = useUIStore((s) => s.closeMomentRecapVideo);

  const [phase, setPhase] = useState<RecapPhase>('generating');
  const [progress, setProgress] = useState<RecapVideoProgress | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const generationRef = useRef(0);

  useEffect(() => {
    if (!visible || !moments?.length) return;

    const generationId = generationRef.current + 1;
    generationRef.current = generationId;
    setPhase('generating');
    setProgress(null);
    setVideoUri(null);
    setErrorMessage(null);
    setSaving(false);

    void (async () => {
      try {
        const uri = await createRecapVideoFromMoments(moments, (next) => {
          if (generationRef.current !== generationId) return;
          setProgress(next);
        });
        if (generationRef.current !== generationId) return;
        setVideoUri(uri);
        setPhase('ready');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        if (generationRef.current !== generationId) return;
        setPhase('error');
        setErrorMessage(error instanceof Error ? error.message : 'Could not create recap video.');
      }
    })();
  }, [visible, moments]);

  if (!visible || !moments?.length) return null;

  const slideCount = moments.filter((moment) => moment.media_url).length;
  const durationLabel = `${Math.round(getRecapVideoDurationSeconds(slideCount))}s`;

  const close = () => {
    generationRef.current += 1;
    closeMomentRecapVideo();
  };

  const handleSave = async () => {
    if (!videoUri || saving) return;
    setSaving(true);
    try {
      const saved = await saveLocalMomentMedia(videoUri, true);
      if (saved) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally {
      setSaving(false);
    }
  };

  const progressRatio =
    progress && progress.total > 0 ? Math.min(1, progress.current / progress.total) : 0;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={close} hitSlop={12} style={styles.headerIcon} accessibilityLabel="Close">
            <Icon name="close" size={26} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Moment recap</Text>
          <View style={styles.headerSide}>
            {phase === 'ready' ? (
              <Pressable onPress={() => void handleSave()} disabled={saving} hitSlop={12}>
                {saving ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <Icon name="download" size={22} color={colors.accent} />
                )}
              </Pressable>
            ) : null}
          </View>
        </View>

        {phase === 'generating' ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={[styles.statusTitle, { color: colors.text }]}>
              {progress?.message ?? 'Preparing your recap…'}
            </Text>
            <Text style={[styles.statusSub, { color: colors.textSecondary }]}>
              {slideCount} moment{slideCount === 1 ? '' : 's'} · about {durationLabel}
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.accent, width: `${Math.max(8, progressRatio * 100)}%` },
                ]}
              />
            </View>
          </View>
        ) : null}

        {phase === 'error' ? (
          <View style={styles.centered}>
            <Icon name="close" size={36} color={colors.textSecondary} />
            <Text style={[styles.statusTitle, { color: colors.text }]}>Could not create recap</Text>
            <Text style={[styles.statusSub, { color: colors.textSecondary, textAlign: 'center' }]}>
              {errorMessage}
            </Text>
            <PrimaryButton label="Close" onPress={close} style={{ marginTop: 20, minWidth: 160 }} />
          </View>
        ) : null}

        {phase === 'ready' && videoUri ? (
          <Suspense
            fallback={
              <View style={styles.centered}>
                <ActivityIndicator color={colors.accent} size="large" />
              </View>
            }>
            <RecapVideoPreview
              uri={videoUri}
              slideCount={slideCount}
              durationLabel={durationLabel}
              saving={saving}
              onSave={() => void handleSave()}
            />
          </Suspense>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerSide: { width: 40, alignItems: 'flex-end' },
  headerIcon: { width: 40, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  statusTitle: { fontSize: 18, fontWeight: '800', marginTop: 8 },
  statusSub: { fontSize: 14, lineHeight: 20 },
  progressTrack: {
    width: '100%',
    maxWidth: 280,
    height: 6,
    borderRadius: 999,
    marginTop: 18,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
});
