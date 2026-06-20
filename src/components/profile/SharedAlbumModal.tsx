import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumStorageBar } from '@/components/profile/AlbumStorageBar';
import { Icon } from '@/components/ui/Icon';
import { useSharedAlbum, useUploadSharedAlbumItem } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { momentChrome } from '@/lib/moment-theme';
import { toUserFacingNetworkError } from '@/lib/network-error';
import { pickAndUploadSharedAlbumMedia } from '@/lib/pick-shared-album-media';
import { enrichSharedAlbumItems, groupSharedAlbumByYearMonth, SharedAlbumStorageLimitError } from '@/lib/shared-album';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import type { SharedAlbumItem } from '@/types/database';

const SCREEN_W = Dimensions.get('window').width;
const GRID_PAD = 2;
const GRID_GAP = 2;
const COLS = 3;
const TILE = Math.floor((SCREEN_W - GRID_PAD * 2 - GRID_GAP * (COLS - 1)) / COLS);

export function SharedAlbumModal() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  const visible = useUIStore((s) => s.showSharedAlbum);
  const setVisible = useUIStore((s) => s.setShowSharedAlbum);
  const openAlbumViewer = useUIStore((s) => s.openAlbumViewer);
  const setSharedAlbumScrollY = useUIStore((s) => s.setSharedAlbumScrollY);
  const savedScrollY = useUIStore((s) => s.sharedAlbumScrollY);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const [uploading, setUploading] = useState(false);

  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const relationship = useRelationshipStore((s) => s.relationship);
  const { isPlus, albumStorageUsedBytes, limits } = useSubscription();
  const { requirePlus } = usePlusGate();
  const uploadItem = useUploadSharedAlbumItem();

  const { data: items = [], isLoading, isError } = useSharedAlbum();

  const displayItems = useMemo(
    () => enrichSharedAlbumItems(items, user, partner),
    [items, user, partner],
  );

  const yearSections = useMemo(() => groupSharedAlbumByYearMonth(displayItems), [displayItems]);

  const photoCount = displayItems.filter((i) => i.media_type === 'photo').length;
  const videoCount = displayItems.filter((i) => i.media_type === 'video').length;

  const dateSpanLabel = useMemo(() => {
    if (displayItems.length === 0) return null;
    const newest = format(new Date(displayItems[0].created_at), 'MMM yyyy');
    const oldest = format(new Date(displayItems[displayItems.length - 1].created_at), 'MMM yyyy');
    return newest === oldest ? newest : `${oldest} – ${newest}`;
  }, [displayItems]);

  useEffect(() => {
    if (!visible || savedScrollY <= 0) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: savedScrollY, animated: false });
    }, 50);
    return () => clearTimeout(t);
  }, [visible, savedScrollY]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  };

  const close = () => setVisible(false);

  const openItem = (item: SharedAlbumItem, sectionItems: SharedAlbumItem[], sectionLabel: string) => {
    const index = sectionItems.findIndex((i) => i.id === item.id);
    if (index < 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSharedAlbumScrollY(scrollYRef.current);
    setVisible(false);
    openAlbumViewer(sectionItems, index, { sectionLabel, returnToAlbum: true });
  };

  const addMedia = async () => {
    if (!user || !relationship || uploading) return;

    if (!isPlus && albumStorageUsedBytes >= limits.albumStorageBytes) {
      requirePlus('Unlimited shared album storage');
      return;
    }

    setUploading(true);
    try {
      const result = await pickAndUploadSharedAlbumMedia(
        (payload) => uploadItem.mutateAsync(payload),
        {
          isPlus,
          usedBytes: albumStorageUsedBytes,
          storageLimitBytes: Number.isFinite(limits.albumStorageBytes)
            ? limits.albumStorageBytes
            : undefined,
        },
      );
      if (result.failed > 0 && result.uploaded === 0) {
        Alert.alert('Upload failed', 'Some items could not be added. Try again.');
      }
    } catch (error) {
      if (error instanceof SharedAlbumStorageLimitError) {
        requirePlus('Unlimited shared album storage');
      } else {
        Alert.alert('Upload failed', toUserFacingNetworkError(error, 'Please try again.').message);
      }
    } finally {
      setUploading(false);
    }
  };

  if (!visible) return null;

  const spaceName = relationship?.relationship_name?.trim() || 'Your space';
  const partnerName = getFirstName(partner?.name) ?? 'Partner';

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={[styles.root, { paddingTop: insets.top, backgroundColor: chrome.background }]}>
        <View style={styles.header}>
          <Pressable onPress={close} hitSlop={12} style={styles.headerIcon} accessibilityLabel="Close">
            <Icon name="close" size={26} color={chrome.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.title, { color: chrome.text }]}>Shared Album</Text>
            <Text style={[styles.subtitle, { color: chrome.textSecondary }]}>
              {spaceName} · Private to you two
            </Text>
          </View>
          <Pressable
            onPress={() => void addMedia()}
            hitSlop={12}
            style={styles.headerIcon}
            accessibilityLabel="Add photos"
            disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color={chrome.accent} size="small" />
            ) : (
              <Icon name="plus" size={26} color={chrome.text} />
            )}
          </Pressable>
        </View>

        <AlbumStorageBar
          usedBytes={albumStorageUsedBytes}
          limitBytes={limits.albumStorageBytes}
          isPlus={isPlus}
          onUpgrade={() => requirePlus('Unlimited shared album storage')}
        />

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={chrome.accent} />
          </View>
        ) : isError ? (
          <View style={styles.centered}>
            <Text style={[styles.emptyTitle, { color: chrome.text }]}>Could not load album</Text>
            <Text style={[styles.emptySub, { color: chrome.textSecondary }]}>Check your connection and try again.</Text>
          </View>
        ) : displayItems.length === 0 ? (
          <View style={styles.centered}>
            <View style={[styles.emptyIcon, { backgroundColor: chrome.surfaceSoft }]}>
              <Icon name="image" size={36} color={chrome.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: chrome.text }]}>Your shared album</Text>
            <Text style={[styles.emptySub, { color: chrome.textSecondary }]}>
              Upload photos and videos for you and {partnerName}, stored privately in Moments.
            </Text>
            <Pressable
              onPress={() => void addMedia()}
              style={({ pressed }) => [
                styles.emptyCta,
                { backgroundColor: chrome.accent },
                pressed && { opacity: 0.9 },
              ]}>
              <Icon name="plus" size={18} color={chrome.onAccent} />
              <Text style={[styles.emptyCtaText, { color: chrome.onAccent }]}>Add photos & videos</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            onScroll={onScroll}
            scrollEventThrottle={32}
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 88 }]}
            showsVerticalScrollIndicator={false}>
            <View style={[styles.statsCard, { backgroundColor: chrome.surfaceSoft, borderColor: chrome.border }]}>
              <Text style={[styles.statsPrimary, { color: chrome.text }]}>
                {photoCount} photo{photoCount === 1 ? '' : 's'}
                {videoCount > 0 ? ` · ${videoCount} video${videoCount === 1 ? '' : 's'}` : ''}
              </Text>
              {dateSpanLabel ? (
                <Text style={[styles.statsSecondary, { color: chrome.textSecondary }]}>{dateSpanLabel}</Text>
              ) : null}
            </View>

            {yearSections.map((year) => (
              <View key={year.key} style={styles.yearBlock}>
                <Text style={[styles.yearLabel, { color: chrome.text }]}>{year.label}</Text>
                {year.months.map((month) => {
                  const sectionLabel = `${month.label} ${year.label}`;
                  return (
                    <View key={month.key} style={styles.monthBlock}>
                      <Text style={[styles.monthLabel, { color: chrome.textSecondary }]}>{month.label}</Text>
                      <View style={styles.grid}>
                        {month.items.map((item) => (
                          <Pressable
                            key={item.id}
                            onPress={() => openItem(item, month.items, sectionLabel)}
                            style={[styles.cell, { width: TILE, height: TILE }]}>
                            <AlbumTile item={item} userId={user?.id} />
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        )}

        {displayItems.length > 0 && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: chrome.border }]}>
            <Pressable
              onPress={() => void addMedia()}
              disabled={uploading}
              style={({ pressed }) => [
                styles.addFab,
                { backgroundColor: chrome.accent },
                pressed && { opacity: 0.9 },
              ]}>
              {uploading ? (
                <ActivityIndicator color={chrome.onAccent} />
              ) : (
                <>
                  <Icon name="plus" size={18} color={chrome.onAccent} />
                  <Text style={[styles.addFabText, { color: chrome.onAccent }]}>Add photos & videos</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

function AlbumTile({ item, userId }: { item: SharedAlbumItem; userId?: string }) {
  const isYours = userId && item.user_id === userId;

  return (
    <View style={styles.tile}>
      {item.media_url ? (
        <>
          <Image source={{ uri: item.media_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
          {item.media_type === 'video' && (
            <View style={styles.videoBadge}>
              <Icon name="videocam" size={11} color="#fff" />
            </View>
          )}
        </>
      ) : null}
      <View style={styles.senderBadge}>
        <Text style={styles.senderText} numberOfLines={1}>
          {isYours ? 'You' : 'Partner'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 8,
  },
  headerIcon: { width: 40, alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  scroll: { paddingHorizontal: GRID_PAD },
  statsCard: {
    marginHorizontal: 10,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  statsPrimary: { fontSize: 15, fontWeight: '800' },
  statsSecondary: { fontSize: 13, fontWeight: '600' },
  yearBlock: { marginBottom: 6 },
  yearLabel: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginHorizontal: 10,
    marginBottom: 10,
    marginTop: 6,
  },
  monthBlock: { marginBottom: 14 },
  monthLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginHorizontal: 10,
    marginBottom: 6,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  cell: { borderRadius: 2, overflow: 'hidden' },
  tile: { flex: 1, borderRadius: 2, overflow: 'hidden', backgroundColor: '#1a1a1a' },
  videoBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    maxWidth: '85%',
  },
  senderText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  addFab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    minWidth: 220,
    justifyContent: 'center',
  },
  addFabText: { fontSize: 15, fontWeight: '800' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
  },
  emptyCtaText: { fontSize: 15, fontWeight: '800' },
});
