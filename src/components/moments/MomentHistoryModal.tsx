import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
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
  const openMomentRecapVideo = useUIStore((s) => s.openMomentRecapVideo);
  const setShowMomentCreator = useUIStore((s) => s.setShowMomentCreator);
  const returnToCamera = useUIStore((s) => s.momentHistoryReturnToCamera);
  const setMomentHistoryReturnToCamera = useUIStore((s) => s.setMomentHistoryReturnToCamera);
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

  /** User-initiated dismiss (X button / hardware back) — returns to the camera if that's where History was opened from. */
  const dismiss = () => {
    close();
    if (returnToCamera) {
      setMomentHistoryReturnToCamera(false);
      setShowMomentCreator(true);
    }
  };

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

    const withMedia = displayMoments.filter((moment) => moment.media_url);
    if (withMedia.length === 0) {
      Alert.alert('Nothing to recap', 'Add at least one photo or video moment first.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const sorted = [...withMedia].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    close();
    openMomentRecapVideo(sorted);
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

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selecting) exitSelection();
      else dismiss();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, selecting]);

  const selectionCount = selectedIds.size;
  const bottomPad = selecting ? insets.bottom + 118 : insets.bottom + 88;

  return (
      <View style={[styles.root, { paddingTop: insets.top, backgroundColor: chrome.background }]}>
        {selecting ? (
          <View style={styles.header}>
            <View style={[styles.side, styles.sideLeft]}>
              <Pressable onPress={exitSelection} hitSlop={12} style={styles.iconSlot} accessibilityLabel="Cancel">
                <Text style={[styles.cancelText, { color: chrome.text }]}>Cancel</Text>
              </Pressable>
            </View>
            <View style={styles.center}>
              <Text style={[styles.title, { color: chrome.text }]} numberOfLines={1}>
                {selectionCount} selected
              </Text>
            </View>
            <View style={[styles.side, styles.sideRight]}>
              <Pressable
                onPress={toggleSelectAll}
                hitSlop={12}
                style={[
                  styles.iconSlot,
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
            <View style={[styles.side, styles.sideLeft]}>
              <Pressable onPress={dismiss} hitSlop={12} style={styles.iconSlot} accessibilityLabel="Close">
                <Icon name="close" size={26} color={chrome.text} />
              </Pressable>
            </View>
            <View style={styles.center}>
              <Text style={[styles.title, { color: chrome.text }]} numberOfLines={1}>
                Your moments
              </Text>
            </View>
            <View style={[styles.side, styles.sideRight]}>
              <Pressable onPress={openCamera} hitSlop={12} style={styles.iconSlot} accessibilityLabel="New moment">
                <Icon name="camera" size={24} color={chrome.text} />
              </Pressable>
            </View>
          </View>
        )}

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={chrome.accent} />
          </View>
        ) : displayMoments.length === 0 ? (
          <View style={styles.centered}>
            <View style={[styles.emptyIcon, { backgroundColor: chrome.surfaceSoft }]}>
              <Icon name="camera" size={36} color={chrome.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: chrome.text }]}>No moments yet</Text>
            <Text style={[styles.emptySub, { color: chrome.textSecondary }]}>
              Photos and videos you share will appear here.
            </Text>
            <Pressable
              onPress={openCamera}
              style={({ pressed }) => [
                styles.emptyCta,
                { backgroundColor: chrome.accent },
                pressed && { opacity: 0.9 },
              ]}>
              <Icon name="camera" size={18} color={chrome.onAccent} />
              <Text style={[styles.emptyCtaText, { color: chrome.onAccent }]}>Send a moment</Text>
            </Pressable>
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
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionLabel, { color: chrome.text }]}>{section.label}</Text>
                  <Text style={[styles.sectionCount, { color: chrome.textTertiary }]}>
                    {section.moments.length}
                  </Text>
                </View>
                <View style={styles.grid}>
                  {section.moments.map((moment) => (
                    <View key={moment.id} style={styles.cell}>
                      <MomentSquircle
                        moment={moment}
                        size={TILE}
                        selecting={selecting}
                        selected={selectedIds.has(moment.id)}
                        isMine={moment.user_id === user?.id}
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
              <View style={[styles.recapIcon, { borderColor: chrome.onAccent }]}>
                <Icon name="plus" size={16} color={chrome.onAccent} />
              </View>
              <Text style={[styles.recapText, { color: chrome.onAccent }]}>Create recap</Text>
            </Pressable>
          </View>
        )}
      </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 8,
  },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  sideLeft: { justifyContent: 'flex-start' },
  sideRight: { justifyContent: 'flex-end' },
  center: { flexShrink: 1, maxWidth: '60%', alignItems: 'center' },
  iconSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  cancelText: { fontSize: 16, fontWeight: '700' },
  selectAllBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  scroll: { paddingHorizontal: GRID_PAD },
  section: { marginBottom: 30, overflow: 'visible' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 14,
  },
  sectionLabel: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  sectionCount: { fontSize: 14, fontWeight: '700' },
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
  recapIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recapText: { fontSize: 16, fontWeight: '800' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
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
