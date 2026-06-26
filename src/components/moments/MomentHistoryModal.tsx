import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { HistoryActionDock } from '@/components/moments/HistoryActionDock';
import { MomentSquircle } from '@/components/moments/MomentSquircle';
import { Icon } from '@/components/ui/Icon';
import { useDeleteMoments, useMoments } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import { downloadMultipleMomentMedia } from '@/lib/download-moment-media';
import { getMockRecapMoments } from '@/lib/mock-recap-moments';
import {
    enrichMomentsWithAuthors,
    filterMediaMoments,
    getHistoryReactionBadge,
    groupMomentsForHistory,
} from '@/lib/moment-display';
import { signMomentsMediaUrl } from '@/lib/moment-media';
import { momentChrome } from '@/lib/moment-theme';
import { toUserFacingNetworkError } from '@/lib/network-error';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import type { Moment } from '@/types/database';

const SCREEN_W = Dimensions.get('window').width;
const GRID_PAD = 12;
const GRID_GAP = 10;
const COLS = 3;
const TILE = Math.floor((SCREEN_W - GRID_PAD * 2 - GRID_GAP * (COLS - 1)) / COLS);

export function MomentHistoryModal() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  const visible = useUIStore((s) => s.showMomentHistory);
  const setVisible = useUIStore((s) => s.setShowMomentHistory);
  const setShowWrapped = useUIStore((s) => s.setShowWrapped);
  const openMomentRecapVideo = useUIStore((s) => s.openMomentRecapVideo);
  const setShowMomentCreator = useUIStore((s) => s.setShowMomentCreator);
  const openMomentViewer = useUIStore((s) => s.openMomentViewer);
  const setMomentHistoryScrollY = useUIStore((s) => s.setMomentHistoryScrollY);
  const savedScrollY = useUIStore((s) => s.momentHistoryScrollY);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const { limits } = useSubscription();
  const { requirePlus } = usePlusGate();

  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllEngaged, setSelectAllEngaged] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const longPressLockRef = useRef(false);
  const recapPreviewLockRef = useRef(false);

  const deleteMomentsMutation = useDeleteMoments();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useMoments();

  const allMoments = useMemo(() => {
    const real = filterMediaMoments(data?.pages.flat() ?? []);
    return enrichMomentsWithAuthors(real, user, partner);
  }, [data, user, partner]);

  const displayMoments = useMemo(() => {
    if (Number.isFinite(limits.timelineMoments)) {
      return allMoments.slice(0, limits.timelineMoments);
    }
    return allMoments;
  }, [allMoments, limits.timelineMoments]);

  const lockedCount = Math.max(0, allMoments.length - displayMoments.length);
  const sections = useMemo(() => groupMomentsForHistory(displayMoments), [displayMoments]);

  const selectedMoments = useMemo(
    () => displayMoments.filter((m) => selectedIds.has(m.id)),
    [displayMoments, selectedIds],
  );

  const deletableSelectedCount = useMemo(
    () => selectedMoments.filter((m) => m.user_id === user?.id).length,
    [selectedMoments, user?.id],
  );

  useEffect(() => {
    if (!visible || savedScrollY <= 0) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: savedScrollY, animated: false });
    }, 50);
    return () => clearTimeout(t);
  }, [visible, savedScrollY]);

  useEffect(() => {
    if (visible) return;
    setSelecting(false);
    setSelectedIds(new Set());
    setSelectAllEngaged(false);
    setDownloading(false);
    setDeleting(false);
    longPressLockRef.current = false;
    recapPreviewLockRef.current = false;
  }, [visible]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  };

  const close = () => setVisible(false);

  const exitSelection = () => {
    setSelecting(false);
    setSelectedIds(new Set());
    setSelectAllEngaged(false);
    longPressLockRef.current = false;
  };

  const toggleSelect = useCallback((momentId: string) => {
    setSelectAllEngaged(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(momentId)) next.delete(momentId);
      else next.add(momentId);
      return next;
    });
  }, []);

  const enterSelection = (momentId: string) => {
    longPressLockRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectAllEngaged(false);
    setSelecting(true);
    setSelectedIds(new Set([momentId]));
  };

  const toggleSelectAll = () => {
    Haptics.selectionAsync();
    if (selectAllEngaged) {
      setSelectAllEngaged(false);
      setSelectedIds(new Set());
      return;
    }
    setSelectAllEngaged(true);
    setSelectedIds(new Set(displayMoments.map((m) => m.id)));
  };

  const openMoment = (moment: Moment, sectionMoments: Moment[], sectionLabel: string) => {
    const index = sectionMoments.findIndex((m) => m.id === moment.id);
    if (index < 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMomentHistoryScrollY(scrollYRef.current);
    setVisible(false);
    openMomentViewer(sectionMoments, index, {
      playback: 'focus',
      sectionLabel,
      returnToHistory: true,
      homeWindowOnly: false,
    });
  };

  const onTilePress = (moment: Moment, sectionMoments: Moment[], sectionLabel: string) => {
    if (longPressLockRef.current) {
      longPressLockRef.current = false;
      return;
    }
    if (selecting) {
      Haptics.selectionAsync();
      toggleSelect(moment.id);
      return;
    }
    openMoment(moment, sectionMoments, sectionLabel);
  };

  const openCamera = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    close();
    setShowMomentCreator(true);
  };

  const openRecap = () => {
    if (recapPreviewLockRef.current) {
      recapPreviewLockRef.current = false;
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    close();
    setShowWrapped(true);
  };

  const openMockRecapPreview = () => {
    recapPreviewLockRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    close();
    openMomentRecapVideo(getMockRecapMoments());
  };

  const ownedSelectedIds = useMemo(
    () => selectedMoments.filter((m) => m.user_id === user?.id).map((m) => m.id),
    [selectedMoments, user?.id],
  );

  const handleDownload = async () => {
    if (selectedMoments.length === 0 || downloading || deleting) return;
    setDownloading(true);
    try {
      const items = await Promise.all(
        selectedMoments
          .filter((m) => m.media_url)
          .map(async (m) => ({
            url: (await signMomentsMediaUrl(m.media_url, 'full')) ?? m.media_url!,
            isVideo: m.type === 'video',
          })),
      );
      const result = await downloadMultipleMomentMedia(items);
      if (result.saved > 0) exitSelection();
    } finally {
      setDownloading(false);
    }
  };

  const handleRecap = () => {
    const withMedia = selectedMoments.filter((moment) => moment.media_url);
    if (withMedia.length === 0 || downloading || deleting) {
      Alert.alert('Nothing to recap', 'Select at least one photo or video moment.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const sorted = [...withMedia].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    exitSelection();
    close();
    openMomentRecapVideo(sorted);
  };

  const handleDelete = () => {
    if (selectedMoments.length === 0 || downloading || deleting || !user) return;

    if (ownedSelectedIds.length === 0) {
      Alert.alert('Cannot delete', 'You can only delete moments you sent.');
      return;
    }

    const skipped = selectedMoments.length - ownedSelectedIds.length;
    const message =
      skipped > 0
        ? `Remove ${ownedSelectedIds.length} moment${ownedSelectedIds.length === 1 ? '' : 's'} you sent? ${skipped} from your partner will stay in your history.`
        : `Remove ${ownedSelectedIds.length} moment${ownedSelectedIds.length === 1 ? '' : 's'}? This removes them for both of you and cannot be undone.`;

    Alert.alert('Delete moments?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setDeleting(true);
            try {
              await deleteMomentsMutation.mutateAsync(ownedSelectedIds);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              exitSelection();
            } catch (error) {
              Alert.alert(
                'Could not delete',
                toUserFacingNetworkError(error, 'Please try again.').message,
              );
            } finally {
              setDeleting(false);
            }
          })();
        },
      },
    ]);
  };

  if (!visible) return null;

  const selectionCount = selectedIds.size;
  const bottomPad = selecting ? insets.bottom + 118 : insets.bottom + 88;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={selecting ? exitSelection : close}>
      <View style={[styles.root, { paddingTop: insets.top, backgroundColor: chrome.background }]}>
        {selecting ? (
          <View style={styles.selectionHeader}>
            <Pressable onPress={exitSelection} hitSlop={12} style={styles.selectionHeaderSide}>
              <Text style={[styles.cancelText, { color: chrome.text }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.selectionHeaderTitle, { color: chrome.text }]}>
              {selectionCount} selected
            </Text>
            <View style={[styles.selectionHeaderSide, styles.selectionHeaderSideRight]}>
              <Pressable
                onPress={toggleSelectAll}
                hitSlop={12}
                style={[
                  styles.selectAllBtn,
                  { borderColor: chrome.border, backgroundColor: chrome.surfaceSoft },
                  selectAllEngaged && { backgroundColor: chrome.accent, borderColor: chrome.accent },
                ]}
                accessibilityLabel={selectAllEngaged ? 'Deselect all' : 'Select all'}>
                <Icon
                  name="checkDone"
                  size={22}
                  color={selectAllEngaged ? chrome.onAccent : chrome.text}
                  filled={selectAllEngaged}
                />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.header}>
            <Pressable onPress={close} hitSlop={12} style={styles.headerIcon} accessibilityLabel="Close">
              <Icon name="close" size={26} color={chrome.text} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={[styles.title, { color: chrome.text }]}>Your moments</Text>
              <Text style={[styles.subtitle, { color: chrome.textSecondary }]}>Only visible to you two</Text>
            </View>
            <Pressable onPress={openCamera} hitSlop={12} style={styles.headerIcon} accessibilityLabel="New moment">
              <Icon name="camera" size={24} color={chrome.text} />
            </Pressable>
          </View>
        )}

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={chrome.accent} />
          </View>
        ) : displayMoments.length === 0 ? (
          <View style={styles.centered}>
            <Icon name="camera" size={40} color={chrome.textTertiary} />
            <Text style={[styles.emptyTitle, { color: chrome.text }]}>No moments yet</Text>
            <Text style={[styles.emptySub, { color: chrome.textSecondary }]}>
              Photos and videos you share will appear here.
            </Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            onScroll={onScroll}
            scrollEventThrottle={32}
            contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
            showsVerticalScrollIndicator={false}>
            {sections.map((section) => (
              <View key={section.key} style={styles.section}>
                <Text style={[styles.sectionLabel, { color: chrome.text }]}>{section.label}</Text>
                <View style={styles.grid}>
                  {section.moments.map((moment) => (
                    <View key={moment.id} style={styles.cell}>
                      <MomentSquircle
                        moment={moment}
                        size={TILE}
                        selecting={selecting}
                        selected={selectedIds.has(moment.id)}
                        reactionBadge={
                          selecting
                            ? null
                            : getHistoryReactionBadge(moment, user?.id ?? '', partner?.id)
                        }
                        onPress={() => onTilePress(moment, section.moments, section.label)}
                        onLongPress={() => enterSelection(moment.id)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {lockedCount > 0 && (
              <Pressable
                onPress={() => requirePlus('Full moment history')}
                style={[styles.unlockBanner, { backgroundColor: chrome.surfaceSoft }]}>
                <Icon name="lock" size={18} color={chrome.text} />
                <Text style={[styles.unlockText, { color: chrome.text }]}>
                  Unlock {lockedCount} more moment{lockedCount === 1 ? '' : 's'} with Plus
                </Text>
              </Pressable>
            )}

            {hasNextPage && Number.isFinite(limits.timelineMoments) === false && (
              <Pressable onPress={() => void fetchNextPage()} disabled={isFetchingNextPage} style={styles.loadMore}>
                {isFetchingNextPage ? (
                  <ActivityIndicator color={chrome.accent} />
                ) : (
                  <Text style={[styles.loadMoreText, { color: chrome.textSecondary }]}>Load more</Text>
                )}
              </Pressable>
            )}
          </ScrollView>
        )}

        {selecting ? (
          <HistoryActionDock
            bottomInset={insets.bottom}
            selectionCount={selectionCount}
            deletableCount={deletableSelectedCount}
            downloading={downloading}
            deleting={deleting}
            onDelete={handleDelete}
            onDownload={() => void handleDownload()}
            onRecap={handleRecap}
          />
        ) : (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
            <Pressable
              onPress={openRecap}
              onLongPress={__DEV__ ? openMockRecapPreview : undefined}
              delayLongPress={400}
              style={({ pressed }) => [
                styles.recapBtn,
                { backgroundColor: chrome.accent },
                pressed && { opacity: 0.9 },
              ]}>
              <Icon name="film" size={20} color={chrome.onAccent} filled />
              <Text style={[styles.recapText, { color: chrome.onAccent }]}>Create recap</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 8,
  },
  headerIcon: { width: 40, alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 8,
  },
  selectionHeaderSide: { width: 72, justifyContent: 'center' },
  selectionHeaderSideRight: { alignItems: 'flex-end' },
  selectionHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
  },
  cancelText: { fontSize: 16, fontWeight: '700' },
  selectAllBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: GRID_PAD },
  section: { marginBottom: 28, overflow: 'visible' },
  sectionLabel: { fontSize: 22, fontWeight: '800', marginBottom: 14, letterSpacing: -0.3 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -GRID_GAP / 2,
    overflow: 'visible',
  },
  cell: {
    width: `${100 / COLS}%`,
    paddingHorizontal: GRID_GAP / 2,
    paddingTop: 10,
    paddingRight: 6,
    marginBottom: GRID_GAP + 10,
    alignItems: 'center',
    overflow: 'visible',
  },
  loadMore: { alignItems: 'center', paddingVertical: 16 },
  loadMoreText: { fontWeight: '700', fontSize: 14 },
  unlockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  unlockText: { fontWeight: '700', fontSize: 14 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: 8,
  },
  recapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
  },
  recapText: { fontSize: 16, fontWeight: '800' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
