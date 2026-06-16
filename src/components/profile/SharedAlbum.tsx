import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Card, PrimaryButton } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { groupMomentsByMonth } from '@/lib/moment-display';
import { useUIStore } from '@/stores';
import type { Moment } from '@/types/database';

const PREVIEW_MONTHS = 3;
const PREVIEW_PER_MONTH = 6;

interface SharedAlbumProps {
  moments: Moment[];
  previewLimit: number;
  hiddenCount: number;
  onOpenFull: () => void;
  onUnlockFull: () => void;
  onAddMoment: () => void;
}

export function SharedAlbum({
  moments,
  previewLimit,
  hiddenCount,
  onOpenFull,
  onUnlockFull,
  onAddMoment,
}: SharedAlbumProps) {
  const { colors } = useTheme();
  const openMomentViewer = useUIStore((s) => s.openMomentViewer);

  const previewMoments = useMemo(
    () => (Number.isFinite(previewLimit) ? moments.slice(0, previewLimit) : moments),
    [moments, previewLimit],
  );

  const monthSections = useMemo(() => groupMomentsByMonth(previewMoments).slice(0, PREVIEW_MONTHS), [previewMoments]);

  const photoCount = moments.filter((m) => m.type === 'photo').length;
  const videoCount = moments.filter((m) => m.type === 'video').length;
  const coverMoments = previewMoments.slice(0, 3);

  const openPreview = (moment: Moment, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openMomentViewer(previewMoments, index, { playback: 'focus' });
  };

  const handleOpenFull = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOpenFull();
  };

  if (moments.length === 0) {
    return (
      <Card style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
          <Icon name="image" size={28} color={colors.accent} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Your shared album is empty</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
          Photos and videos you send each other will collect here, just for the two of you.
        </Text>
        <PrimaryButton label="Add to album" onPress={onAddMoment} style={{ marginTop: 8, minWidth: 180 }} />
      </Card>
    );
  }

  return (
    <View style={styles.root}>
      <Pressable onPress={handleOpenFull}>
        <Card style={[styles.coverCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.coverMosaic}>
            {coverMoments.length >= 3 ? (
              <>
                <CoverTile moment={coverMoments[0]} style={styles.coverLarge} />
                <View style={styles.coverStack}>
                  <CoverTile moment={coverMoments[1]} style={styles.coverSmall} />
                  <CoverTile moment={coverMoments[2]} style={styles.coverSmall} />
                </View>
              </>
            ) : coverMoments.length === 2 ? (
              <>
                <CoverTile moment={coverMoments[0]} style={styles.coverHalf} />
                <CoverTile moment={coverMoments[1]} style={styles.coverHalf} />
              </>
            ) : (
              <CoverTile moment={coverMoments[0]} style={styles.coverFull} />
            )}
          </View>

          <View style={styles.coverMeta}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.coverTitle, { color: colors.text }]}>Shared album</Text>
              <Text style={[styles.coverSub, { color: colors.textSecondary }]}>
                {photoCount} photo{photoCount === 1 ? '' : 's'}
                {videoCount > 0 ? ` · ${videoCount} video${videoCount === 1 ? '' : 's'}` : ''}
                {' · '}
                {format(new Date(moments[0].created_at), 'MMM yyyy')}
                {moments.length > 1 ? ` – ${format(new Date(moments[moments.length - 1].created_at), 'MMM yyyy')}` : ''}
              </Text>
            </View>
            <Icon name="chevronRight" size={20} color={colors.textTertiary} />
          </View>
        </Card>
      </Pressable>

      {monthSections.map((section) => (
        <View key={section.key} style={styles.monthBlock}>
          <Text style={[styles.monthLabel, { color: colors.textSecondary }]}>{section.label}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthScroll}>
            {section.moments.slice(0, PREVIEW_PER_MONTH).map((moment) => {
              const index = previewMoments.findIndex((m) => m.id === moment.id);
              return (
                <Pressable
                  key={moment.id}
                  onPress={() => openPreview(moment, index >= 0 ? index : 0)}
                  style={[styles.thumb, { backgroundColor: colors.surfaceElevated }]}>
                  {moment.media_url ? (
                    <>
                      <Image source={{ uri: moment.media_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      {moment.type === 'video' && (
                        <View style={styles.videoBadge}>
                          <Icon name="videocam" size={12} color="#fff" />
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={[StyleSheet.absoluteFill, styles.thumbFallback, { backgroundColor: colors.accentSoft }]}>
                      <Icon name="heart" size={20} color={colors.accent} filled />
                    </View>
                  )}
                </Pressable>
              );
            })}
            {section.moments.length > PREVIEW_PER_MONTH && (
              <Pressable
                onPress={handleOpenFull}
                style={[styles.moreThumb, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Text style={[styles.moreThumbText, { color: colors.text }]}>+{section.moments.length - PREVIEW_PER_MONTH}</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      ))}

      {hiddenCount > 0 && (
        <Pressable
          onPress={onUnlockFull}
          style={[styles.upsell, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <Icon name="lock" size={18} color={colors.accent} />
          <Text style={[styles.upsellText, { color: colors.text }]}>
            {hiddenCount} more in your album with Plus
          </Text>
          <Icon name="chevronRight" size={18} color={colors.accent} />
        </Pressable>
      )}

      <PrimaryButton label="Open shared album" onPress={handleOpenFull} />
    </View>
  );
}

function CoverTile({ moment, style }: { moment: Moment; style: object }) {
  return (
    <View style={[styles.coverTile, style]}>
      {moment.media_url ? (
        <>
          <Image source={{ uri: moment.media_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
          {moment.type === 'video' && (
            <View style={styles.coverVideoBadge}>
              <Icon name="videocam" size={14} color="#fff" />
            </View>
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptySub: { fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: 12 },
  coverCard: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, padding: 0 },
  coverMosaic: { flexDirection: 'row', height: 168, gap: 3, padding: 3 },
  coverTile: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#1a1a1a' },
  coverLarge: { flex: 1.2 },
  coverStack: { flex: 1, gap: 3 },
  coverSmall: { flex: 1 },
  coverHalf: { flex: 1 },
  coverFull: { flex: 1 },
  coverVideoBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverMeta: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  coverTitle: { fontSize: 17, fontWeight: '800' },
  coverSub: { fontSize: 13, lineHeight: 18 },
  monthBlock: { gap: 10 },
  monthLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  monthScroll: { gap: 8, paddingRight: 4 },
  thumb: { width: 88, height: 88, borderRadius: 14, overflow: 'hidden' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  videoBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreThumb: {
    width: 88,
    height: 88,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreThumbText: { fontSize: 15, fontWeight: '800' },
  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  upsellText: { flex: 1, fontSize: 14, fontWeight: '700' },
});
