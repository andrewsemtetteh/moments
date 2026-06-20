import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AlbumStorageBar } from '@/components/profile/AlbumStorageBar';
import { Icon } from '@/components/ui/Icon';
import { Card, PrimaryButton } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { formatStorageBytes, groupSharedAlbumByMonth } from '@/lib/shared-album';
import type { SharedAlbumItem } from '@/types/database';

const PREVIEW_MONTHS = 3;
const PREVIEW_PER_MONTH = 6;

interface SharedAlbumProps {
  items: SharedAlbumItem[];
  usedBytes: number;
  storageLimitBytes: number;
  isPlus: boolean;
  onOpenFull: () => void;
  onUnlockStorage: () => void;
  onAddMedia: () => void;
}

export function SharedAlbum({
  items,
  usedBytes,
  storageLimitBytes,
  isPlus,
  onOpenFull,
  onUnlockStorage,
  onAddMedia,
}: SharedAlbumProps) {
  const { colors } = useTheme();

  const monthSections = useMemo(() => groupSharedAlbumByMonth(items).slice(0, PREVIEW_MONTHS), [items]);

  const photoCount = items.filter((i) => i.media_type === 'photo').length;
  const videoCount = items.filter((i) => i.media_type === 'video').length;
  const coverItems = items.slice(0, 3);
  const storageFull = !isPlus && usedBytes >= storageLimitBytes;

  const handleOpenFull = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOpenFull();
  };

  if (items.length === 0) {
    return (
      <View style={styles.root}>
        <AlbumStorageBar
          usedBytes={usedBytes}
          limitBytes={storageLimitBytes}
          isPlus={isPlus}
          onUpgrade={onUnlockStorage}
        />
        <Card style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
            <Icon name="image" size={28} color={colors.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Shared Album</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Upload photos and videos for just the two of you, with {formatStorageBytes(storageLimitBytes)} free storage.
          </Text>
          <PrimaryButton label="Add photos & videos" onPress={onAddMedia} style={{ marginTop: 8, minWidth: 200 }} />
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AlbumStorageBar
        usedBytes={usedBytes}
        limitBytes={storageLimitBytes}
        isPlus={isPlus}
        onUpgrade={onUnlockStorage}
      />

      <Pressable onPress={handleOpenFull}>
        <Card style={[styles.coverCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.coverMosaic}>
            {coverItems.length >= 3 ? (
              <>
                <CoverTile item={coverItems[0]} style={styles.coverLarge} />
                <View style={styles.coverStack}>
                  <CoverTile item={coverItems[1]} style={styles.coverSmall} />
                  <CoverTile item={coverItems[2]} style={styles.coverSmall} />
                </View>
              </>
            ) : coverItems.length === 2 ? (
              <>
                <CoverTile item={coverItems[0]} style={styles.coverHalf} />
                <CoverTile item={coverItems[1]} style={styles.coverHalf} />
              </>
            ) : (
              <CoverTile item={coverItems[0]} style={styles.coverFull} />
            )}
          </View>

          <View style={styles.coverMeta}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.coverTitle, { color: colors.text }]}>Shared Album</Text>
              <Text style={[styles.coverSub, { color: colors.textSecondary }]}>
                {photoCount} photo{photoCount === 1 ? '' : 's'}
                {videoCount > 0 ? ` · ${videoCount} video${videoCount === 1 ? '' : 's'}` : ''}
                {' · '}
                {format(new Date(items[0].created_at), 'MMM yyyy')}
                {items.length > 1 ? ` – ${format(new Date(items[items.length - 1].created_at), 'MMM yyyy')}` : ''}
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
            {section.items.slice(0, PREVIEW_PER_MONTH).map((item) => (
              <Pressable
                key={item.id}
                onPress={handleOpenFull}
                style={[styles.thumb, { backgroundColor: colors.surfaceElevated }]}>
                {item.media_url ? (
                  <>
                    <Image source={{ uri: item.media_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    {item.media_type === 'video' && (
                      <View style={styles.videoBadge}>
                        <Icon name="videocam" size={12} color="#fff" />
                      </View>
                    )}
                  </>
                ) : null}
              </Pressable>
            ))}
            {section.items.length > PREVIEW_PER_MONTH && (
              <Pressable
                onPress={handleOpenFull}
                style={[styles.moreThumb, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Text style={[styles.moreThumbText, { color: colors.text }]}>+{section.items.length - PREVIEW_PER_MONTH}</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      ))}

      {storageFull && (
        <Pressable
          onPress={onUnlockStorage}
          style={[styles.upsell, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <Icon name="lock" size={18} color={colors.accent} />
          <Text style={[styles.upsellText, { color: colors.text }]}>
            Album full — get unlimited storage with Plus
          </Text>
          <Icon name="chevronRight" size={18} color={colors.accent} />
        </Pressable>
      )}

      <PrimaryButton label="Open Shared Album" onPress={handleOpenFull} />
      <Pressable onPress={onAddMedia} style={styles.addLink}>
        <Icon name="plus" size={16} color={colors.accent} />
        <Text style={[styles.addLinkText, { color: colors.accent }]}>Add photos & videos</Text>
      </Pressable>
    </View>
  );
}

function CoverTile({ item, style }: { item: SharedAlbumItem; style: object }) {
  return (
    <View style={[styles.coverTile, style]}>
      {item.media_url ? (
        <>
          <Image source={{ uri: item.media_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
          {item.media_type === 'video' && (
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
  addLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  addLinkText: { fontSize: 14, fontWeight: '800' },
});
