import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HistoryActionDock } from '@/components/moments/HistoryActionDock';
import { AlbumEditSheet, AlbumPickerSheet, AlbumsShelf } from '@/components/moments/MomentAlbums';
import { OurMapCard, OurMapView, placeTitle } from '@/components/moments/MomentPlaces';
import { MomentSquircle } from '@/components/moments/MomentSquircle';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useDeleteMoments, useMoments } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import { downloadMultipleMomentMedia } from '@/lib/download-moment-media';
import { FREE_ALBUM_LIMIT, useMomentAlbums, type MomentAlbum } from '@/lib/moment-albums';
import {
  PLACE_EMOJIS,
  PLACE_NAME_IDEAS,
  groupMomentsIntoPlaces,
  useMomentPlaces,
  type MomentPlace,
} from '@/lib/moment-places';
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
const DISMISS_DISTANCE = 72;
const DISMISS_VELOCITY = 650;
const SETTLE_SPRING = { damping: 32, stiffness: 280, mass: 0.9 };

/**
 * The grid is flattened into rows (a month heading, then rows of 3 tiles) so
 * FlatList only renders what's on screen — history can run to hundreds.
 */
type HistoryRow =
  | { kind: 'header'; key: string; label: string; count: number }
  | {
      kind: 'tiles';
      key: string;
      moments: Moment[];
      sectionMoments: Moment[];
      sectionLabel: string;
      lastInSection: boolean;
    };

type SheetState =
  | { kind: 'create'; pendingIds: string[] | null }
  | { kind: 'rename'; album: MomentAlbum }
  | { kind: 'picker' }
  | { kind: 'place'; place: MomentPlace }
  | null;

function toRows(key: string, label: string, moments: Moment[], withHeader: boolean): HistoryRow[] {
  const out: HistoryRow[] = [];
  if (withHeader) out.push({ kind: 'header', key: `h-${key}`, label, count: moments.length });
  for (let i = 0; i < moments.length; i += COLS) {
    out.push({
      kind: 'tiles',
      key: `r-${key}-${i}`,
      moments: moments.slice(i, i + COLS),
      sectionMoments: moments,
      sectionLabel: label,
      lastInSection: i + COLS >= moments.length,
    });
  }
  return out;
}

export function MomentHistoryModal() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  const visible = useUIStore((s) => s.showMomentHistory);
  const setVisible = useUIStore((s) => s.setShowMomentHistory);
  const setShowMomentCreator = useUIStore((s) => s.setShowMomentCreator);
  const returnToCamera = useUIStore((s) => s.momentHistoryReturnToCamera);
  const setMomentHistoryReturnToCamera = useUIStore((s) => s.setMomentHistoryReturnToCamera);
  const openMomentViewer = useUIStore((s) => s.openMomentViewer);
  const setMomentHistoryScrollY = useUIStore((s) => s.setMomentHistoryScrollY);
  const savedScrollY = useUIStore((s) => s.momentHistoryScrollY);
  const albumId = useUIStore((s) => s.momentHistoryAlbumId);
  const setAlbumId = useUIStore((s) => s.setMomentHistoryAlbumId);
  const mapOpen = useUIStore((s) => s.momentHistoryMapOpen);
  const setMapOpen = useUIStore((s) => s.setMomentHistoryMapOpen);
  const listRef = useRef<FlatList<HistoryRow>>(null);
  const scrollYRef = useRef(0);
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const { limits } = useSubscription();
  const { isPlus, requirePlus } = usePlusGate();
  const {
    albums,
    createAlbum,
    addMoments,
    removeMoment,
    pruneMoments,
    setCover,
    updateAlbum,
    deleteAlbum,
  } = useMomentAlbums();
  const { store: placesStore, namePlace } = useMomentPlaces();

  const [selecting, setSelecting] = useState(false);
  /** Set while picking moments for one album (after "New album" or "Add moments"). */
  const [addTarget, setAddTarget] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllEngaged, setSelectAllEngaged] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  const longPressLockRef = useRef(false);

  const deleteMomentsMutation = useDeleteMoments();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useMoments();

  const allMoments = useMemo(() => {
    const real = filterMediaMoments(data?.pages.flat() ?? []);
    return enrichMomentsWithAuthors(real, user, partner);
  }, [data, user, partner]);

  const momentsById = useMemo(() => new Map(allMoments.map((m) => [m.id, m])), [allMoments]);

  const displayMoments = useMemo(() => {
    if (Number.isFinite(limits.timelineMoments)) {
      return allMoments.slice(0, limits.timelineMoments);
    }
    return allMoments;
  }, [allMoments, limits.timelineMoments]);

  const openAlbum = albumId ? (albums.find((a) => a.id === albumId) ?? null) : null;
  const targetAlbum = addTarget ? (albums.find((a) => a.id === addTarget) ?? null) : null;
  // An album view only shows while not picking moments (picking uses the full grid).
  const inAlbum = !!openAlbum && !selecting;
  const inMap = mapOpen && !selecting && !openAlbum;

  // Every pinned moment (yours and your partner's), grouped by spot.
  const places = useMemo(
    () => groupMomentsIntoPlaces(allMoments, placesStore),
    [allMoments, placesStore],
  );

  const albumMoments = useMemo(
    () =>
      openAlbum
        ? openAlbum.momentIds.map((id) => momentsById.get(id)).filter((m): m is Moment => !!m)
        : [],
    [openAlbum, momentsById],
  );

  const lockedCount = Math.max(0, allMoments.length - displayMoments.length);
  const rows = useMemo(() => {
    if (inAlbum && openAlbum) return toRows(openAlbum.id, openAlbum.name, albumMoments, false);
    return groupMomentsForHistory(displayMoments).flatMap((section) =>
      toRows(section.key, section.label, section.moments, true),
    );
  }, [inAlbum, openAlbum, albumMoments, displayMoments]);

  // Free accounts still page in until they've loaded enough to fill their
  // limit (and to know how many more are locked); Plus loads everything.
  const wantsMore =
    !Number.isFinite(limits.timelineMoments) || allMoments.length < limits.timelineMoments;
  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage && wantsMore) void fetchNextPage();
  };

  const selectedMoments = useMemo(
    () => displayMoments.filter((m) => selectedIds.has(m.id)),
    [displayMoments, selectedIds],
  );

  const deletableSelectedCount = useMemo(
    () => selectedMoments.filter((m) => m.user_id === user?.id).length,
    [selectedMoments, user?.id],
  );

  useEffect(() => {
    if (!visible || savedScrollY <= 0 || albumId) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: savedScrollY, animated: false });
    }, 50);
    return () => clearTimeout(t);
  }, [visible, savedScrollY, albumId]);

  useEffect(() => {
    if (visible) return;
    setSelecting(false);
    setAddTarget(null);
    setSelectedIds(new Set());
    setSelectAllEngaged(false);
    setDownloading(false);
    setDeleting(false);
    setSheet(null);
    longPressLockRef.current = false;
  }, [visible]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  };

  const close = () => setVisible(false);

  /** User-initiated dismiss (X / swipe / hardware back) — returns to the camera if that's where History was opened from. */
  const dismiss = () => {
    setAlbumId(null);
    setMapOpen(false);
    close();
    if (returnToCamera) {
      setMomentHistoryReturnToCamera(false);
      setShowMomentCreator(true);
    }
  };

  const exitSelection = () => {
    setSelecting(false);
    setAddTarget(null);
    setSelectedIds(new Set());
    setSelectAllEngaged(false);
    longPressLockRef.current = false;
  };

  /** Cancel in "add to album" mode goes back to that album. */
  const cancelSelection = () => {
    const target = addTarget;
    exitSelection();
    if (target) setAlbumId(target);
  };

  const leaveAlbum = () => {
    Haptics.selectionAsync();
    setAlbumId(null);
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
    if (!albumId) setMomentHistoryScrollY(scrollYRef.current);
    setVisible(false);
    openMomentViewer(sectionMoments, index, {
      playback: 'focus',
      sectionLabel,
      returnToHistory: true,
      homeWindowOnly: false,
    });
  };

  const albumMomentOptions = (moment: Moment) => {
    if (!openAlbum) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(openAlbum.name, undefined, [
      { text: 'Make album cover', onPress: () => setCover(openAlbum.id, moment.id) },
      {
        text: 'Remove from album',
        style: 'destructive',
        onPress: () => removeMoment(openAlbum.id, moment.id),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
    setAlbumId(null);
    setMapOpen(false);
    close();
    setShowMomentCreator(true);
  };

  // ── Albums ────────────────────────────────────────────────────────────

  /** Free accounts get FREE_ALBUM_LIMIT albums; the next one opens the paywall. */
  const canCreateAlbum = () => isPlus || albums.length < FREE_ALBUM_LIMIT || requirePlus('Unlimited albums');

  const startNewAlbum = (pendingIds: string[] | null = null) => {
    if (!canCreateAlbum()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheet({ kind: 'create', pendingIds });
  };

  const onCreateAlbum = ({ name, emoji }: { name: string; emoji: string }) => {
    const pending = sheet?.kind === 'create' ? sheet.pendingIds : null;
    setSheet(null);
    if (pending?.length) {
      // From select mode: the album is born with the picked moments.
      const album = createAlbum({ name, emoji, momentIds: pending });
      exitSelection();
      setAlbumId(album.id);
      return;
    }
    // From "New album": create it, then pick its moments.
    const album = createAlbum({ name, emoji });
    setAlbumId(null);
    setAddTarget(album.id);
    setSelectedIds(new Set());
    setSelectAllEngaged(false);
    setSelecting(true);
  };

  const startAddingToOpenAlbum = () => {
    if (!openAlbum) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddTarget(openAlbum.id);
    setSelectedIds(new Set());
    setSelectAllEngaged(false);
    setSelecting(true);
  };

  const confirmAddToTarget = () => {
    if (!addTarget || selectedIds.size === 0) return;
    addMoments(addTarget, [...selectedIds]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const target = addTarget;
    exitSelection();
    setAlbumId(target);
  };

  const addSelectionToAlbum = (album: MomentAlbum) => {
    addMoments(album.id, [...selectedIds]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSheet(null);
    exitSelection();
    setAlbumId(album.id);
  };

  const albumMenu = () => {
    if (!openAlbum) return;
    Alert.alert(`${openAlbum.emoji} ${openAlbum.name}`, undefined, [
      { text: 'Rename', onPress: () => setSheet({ kind: 'rename', album: openAlbum }) },
      {
        text: 'Delete album',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete album?', 'The moments stay in your history — only the album goes.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                deleteAlbum(openAlbum.id);
                setAlbumId(null);
              },
            },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Select-mode actions ───────────────────────────────────────────────

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
              pruneMoments(ownedSelectedIds);
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
      if (sheet) setSheet(null);
      else if (selecting) cancelSelection();
      else if (albumId) setAlbumId(null);
      else if (mapOpen) setMapOpen(false);
      else dismiss();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, selecting, sheet, albumId, addTarget, mapOpen]);

  // Swipe right anywhere: back out of an album, otherwise close History.
  // Only claims clearly horizontal drags, so the grid still scrolls.
  const translateX = useSharedValue(0);
  const onSwipedAway = () => {
    if (albumId) {
      setAlbumId(null);
      translateX.value = 0;
      return;
    }
    dismiss();
  };
  const swipeClose = Gesture.Pan()
    .enabled(!selecting && !sheet && !inMap)
    .activeOffsetX(12)
    .failOffsetX(-8)
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      translateX.value = Math.max(0, e.translationX);
    })
    .onEnd((e) => {
      if (e.translationX > DISMISS_DISTANCE || e.velocityX > DISMISS_VELOCITY) {
        translateX.value = withSpring(SCREEN_W, { ...SETTLE_SPRING, velocity: e.velocityX }, (done) => {
          if (done) runOnJS(onSwipedAway)();
        });
        return;
      }
      translateX.value = withSpring(0, { ...SETTLE_SPRING, velocity: e.velocityX });
    });
  const swipeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  const selectionCount = selectedIds.size;
  const bottomPad = selecting ? insets.bottom + 118 : insets.bottom + 88;

  const renderRow = ({ item }: { item: HistoryRow }) => {
    if (item.kind === 'header') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionLabel, { color: chrome.text }]}>{item.label}</Text>
          <Text style={[styles.sectionCount, { color: chrome.textTertiary }]}>{item.count}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.grid, item.lastInSection && styles.gridSectionEnd]}>
        {item.moments.map((moment) => (
          <View key={moment.id} style={styles.cell}>
            <MomentSquircle
              moment={moment}
              size={TILE}
              selecting={selecting}
              selected={selectedIds.has(moment.id)}
              isMine={moment.user_id === user?.id}
              reactionBadge={
                selecting ? null : getHistoryReactionBadge(moment, user?.id ?? '', partner?.id)
              }
              onPress={() => onTilePress(moment, item.sectionMoments, item.sectionLabel)}
              onLongPress={() => (inAlbum ? albumMomentOptions(moment) : enterSelection(moment.id))}
            />
          </View>
        ))}
      </View>
    );
  };

  // ── Header (one row: left icon · centered title · right icon) ─────────

  let headerLeft: React.ReactNode;
  let headerTitle: string;
  let headerRight: React.ReactNode;
  if (selecting) {
    headerLeft = (
      <Pressable onPress={cancelSelection} hitSlop={12} style={styles.textAction} accessibilityLabel="Cancel">
        <Text style={[styles.cancelText, { color: chrome.text }]}>Cancel</Text>
      </Pressable>
    );
    headerTitle = targetAlbum ? `Add to ${targetAlbum.name}` : `${selectionCount} selected`;
    headerRight = (
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
    );
  } else if (inMap) {
    headerLeft = (
      <HeaderIconButton icon="chevronLeft" onPress={() => setMapOpen(false)} accessibilityLabel="Back to all moments" />
    );
    headerTitle = 'Our map';
    headerRight = null;
  } else if (inAlbum && openAlbum) {
    headerLeft = <HeaderIconButton icon="chevronLeft" onPress={leaveAlbum} accessibilityLabel="Back to all moments" />;
    headerTitle = `${openAlbum.emoji} ${openAlbum.name}`;
    headerRight = <HeaderIconButton icon="more" onPress={albumMenu} accessibilityLabel="Album options" />;
  } else {
    // Back, not close: History sits on top of where you came from (Home or the
    // camera) and swipes away to the right, so it behaves like a pushed page.
    headerLeft = (
      <HeaderIconButton
        icon="chevronLeft"
        onPress={dismiss}
        accessibilityLabel={returnToCamera ? 'Back to camera' : 'Back'}
      />
    );
    headerTitle = 'Our moments';
    headerRight = <HeaderIconButton icon="camera" onPress={openCamera} accessibilityLabel="New moment" />;
  }

  const emptyAll = !isLoading && displayMoments.length === 0;

  return (
    <GestureDetector gesture={swipeClose}>
      <Animated.View
        style={[styles.root, { paddingTop: insets.top, backgroundColor: chrome.background }, swipeStyle]}>
        <View style={styles.header}>
          <View style={[styles.side, styles.sideLeft]}>{headerLeft}</View>
          <View style={styles.center}>
            <Text style={[styles.title, { color: chrome.text }]} numberOfLines={1}>
              {headerTitle}
            </Text>
          </View>
          <View style={[styles.side, styles.sideRight]}>{headerRight}</View>
        </View>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={chrome.accent} />
          </View>
        ) : inMap ? (
          <OurMapView
            places={places}
            bottomInset={insets.bottom}
            onOpenPlace={(place) => {
              const first = place.moments[0];
              if (first) openMoment(first, place.moments, placeTitle(place));
            }}
            onNamePlace={(place) => setSheet({ kind: 'place', place })}
          />
        ) : emptyAll ? (
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
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(row) => row.key}
            renderItem={renderRow}
            extraData={[selecting, selectedIds, inAlbum]}
            onScroll={onScroll}
            scrollEventThrottle={32}
            onEndReached={loadMore}
            onEndReachedThreshold={0.6}
            initialNumToRender={8}
            windowSize={9}
            contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              inAlbum && openAlbum ? (
                <Text style={[styles.albumMeta, { color: chrome.textSecondary }]}>
                  {albumMoments.length} moment{albumMoments.length === 1 ? '' : 's'} · long-press one to make it the cover
                </Text>
              ) : !selecting ? (
                <>
                  <OurMapCard
                    places={places}
                    onOpen={() => {
                      Haptics.selectionAsync();
                      setMapOpen(true);
                    }}
                  />
                  <AlbumsShelf
                    albums={albums}
                    momentsById={momentsById}
                    onOpen={(album) => {
                      Haptics.selectionAsync();
                      setAlbumId(album.id);
                    }}
                    onCreate={() => startNewAlbum()}
                  />
                </>
              ) : null
            }
            ListEmptyComponent={
              inAlbum ? (
                <View style={styles.albumEmpty}>
                  <Text style={styles.albumEmptyEmoji}>{openAlbum?.emoji}</Text>
                  <Text style={[styles.emptyTitle, { color: chrome.text }]}>Nothing in here yet</Text>
                  <Text style={[styles.emptySub, { color: chrome.textSecondary }]}>
                    Add moments you want to keep together.
                  </Text>
                </View>
              ) : null
            }
            ListFooterComponent={
              <>
                {!inAlbum && lockedCount > 0 && (
                  <Pressable
                    onPress={() => requirePlus('Full moment history')}
                    style={[styles.unlockBanner, { backgroundColor: chrome.surfaceSoft }]}>
                    <Icon name="lock" size={18} color={chrome.text} />
                    <Text style={[styles.unlockText, { color: chrome.text }]}>
                      Unlock {lockedCount} more moment{lockedCount === 1 ? '' : 's'} with Plus
                    </Text>
                  </Pressable>
                )}
                {isFetchingNextPage ? (
                  <View style={styles.loadMore}>
                    <ActivityIndicator color={chrome.accent} />
                  </View>
                ) : null}
              </>
            }
          />
        )}

        {selecting && addTarget ? (
          <FloatingButton
            icon="albums"
            label={
              selectionCount > 0
                ? `Add ${selectionCount} moment${selectionCount === 1 ? '' : 's'}`
                : 'Pick moments to add'
            }
            disabled={selectionCount === 0}
            onPress={confirmAddToTarget}
            bottomInset={insets.bottom}
          />
        ) : selecting ? (
          <HistoryActionDock
            bottomInset={insets.bottom}
            selectionCount={selectionCount}
            deletableCount={deletableSelectedCount}
            downloading={downloading}
            deleting={deleting}
            onDelete={handleDelete}
            onDownload={() => void handleDownload()}
            onAddToAlbum={() => {
              if (selectionCount === 0) return;
              if (albums.length === 0) startNewAlbum([...selectedIds]);
              else setSheet({ kind: 'picker' });
            }}
          />
        ) : inAlbum ? (
          <FloatingButton icon="plus" label="Add moments" onPress={startAddingToOpenAlbum} bottomInset={insets.bottom} />
        ) : inMap ? null : !emptyAll && !isLoading ? (
          <FloatingButton icon="albums" label="New album" onPress={() => startNewAlbum()} bottomInset={insets.bottom} />
        ) : null}

        {sheet?.kind === 'create' ? (
          <AlbumEditSheet
            title="New album"
            submitLabel={sheet.pendingIds?.length ? 'Create album' : 'Next: pick moments'}
            onSubmit={onCreateAlbum}
            onClose={() => setSheet(null)}
          />
        ) : sheet?.kind === 'rename' ? (
          <AlbumEditSheet
            title="Edit album"
            submitLabel="Save"
            initialName={sheet.album.name}
            initialEmoji={sheet.album.emoji}
            onSubmit={(value) => {
              updateAlbum(sheet.album.id, value);
              setSheet(null);
            }}
            onClose={() => setSheet(null)}
          />
        ) : sheet?.kind === 'place' ? (
          <AlbumEditSheet
            title={sheet.place.name ? 'Rename this place' : 'Name this place'}
            submitLabel="Save"
            placeholder="Place name"
            emojis={PLACE_EMOJIS}
            ideas={PLACE_NAME_IDEAS}
            initialName={sheet.place.name?.name ?? ''}
            initialEmoji={sheet.place.name?.emoji}
            onSubmit={(value) => {
              namePlace(sheet.place.key, value);
              setSheet(null);
            }}
            onClose={() => setSheet(null)}
          />
        ) : sheet?.kind === 'picker' ? (
          <AlbumPickerSheet
            albums={albums}
            count={selectionCount}
            onPick={addSelectionToAlbum}
            onNew={() => {
              setSheet(null);
              startNewAlbum([...selectedIds]);
            }}
            onClose={() => setSheet(null)}
          />
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

function FloatingButton({
  icon,
  label,
  onPress,
  disabled,
  bottomInset,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  bottomInset: number;
}) {
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  return (
    <View style={[styles.footer, { paddingBottom: bottomInset + 16 }]} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.floatingBtn,
          { backgroundColor: chrome.accent, opacity: disabled ? 0.45 : pressed ? 0.9 : 1 },
        ]}>
        <Icon name={icon} size={20} color={chrome.onAccent} />
        <Text style={[styles.floatingText, { color: chrome.onAccent }]}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 12,
    paddingTop: 6,
  },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  sideLeft: { justifyContent: 'flex-start' },
  sideRight: { justifyContent: 'flex-end' },
  center: { flexShrink: 1, maxWidth: '64%', alignItems: 'center' },
  textAction: { height: 44, justifyContent: 'center', paddingHorizontal: 10 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  cancelText: { fontSize: 16, fontWeight: '700' },
  selectAllBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: GRID_PAD },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 14,
  },
  sectionLabel: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sectionCount: { fontSize: 14, fontWeight: '700' },
  albumMeta: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 14 },
  albumEmpty: { alignItems: 'center', gap: 8, paddingTop: 60, paddingHorizontal: 32 },
  albumEmptyEmoji: { fontSize: 48, marginBottom: 4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -GRID_GAP / 2,
    overflow: 'visible',
  },
  // Cells already carry 20pt of bottom margin; this tops a section's end up to ~30.
  gridSectionEnd: { marginBottom: 10 },
  cell: {
    width: `${100 / COLS}%`,
    paddingHorizontal: GRID_GAP / 2,
    paddingTop: 10,
    marginBottom: GRID_GAP + 10,
    alignItems: 'center',
    overflow: 'visible',
  },
  loadMore: { alignItems: 'center', paddingVertical: 16 },
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
  floatingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderRadius: 999,
  },
  floatingText: { fontSize: 16, fontWeight: '800' },
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
