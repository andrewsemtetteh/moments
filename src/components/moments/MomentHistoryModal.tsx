import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import { mediaSource } from '@/lib/storage-cdn';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from '@/lib/haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HistoryActionDock } from '@/components/moments/HistoryActionDock';
import {
  ActionSheet,
  AlbumEditSheet,
  AlbumPickerSheet,
  AlbumsShelf,
  type SheetAction,
} from '@/components/moments/MomentAlbums';
import { OurMapCard, OurMapView, placeTitle } from '@/components/moments/MomentPlaces';
import { MomentTile } from '@/components/moments/MomentTile';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colorWithAlpha, cardSurface, cardEdge } from '@/components/ui/primitives';
import { ThemedStatusBar } from '@/components/ui/ThemedStatusBar';
import { introBand } from '@/components/home/WelcomeCard';
import { useDeleteMoments, useMoments } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import {
  ALBUM_UPLOAD_MAX,
  pickAlbumMedia,
  uploadToAlbum,
  useAlbumUploadStore,
  type PickedMedia,
} from '@/lib/album-upload';
import { downloadMultipleMomentMedia } from '@/lib/download-moment-media';
import { albumCoverId, FREE_ALBUM_LIMIT, useMomentAlbums, type MomentAlbum } from '@/lib/moment-albums';
import { markIcon, PLACE_ICONS } from '@/lib/mark-icons';
import { groupMomentsIntoPlaces, useMomentPlaces, type MomentPlace } from '@/lib/moment-places';
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
import { MOMENTS_BACK, useMomentsBack } from '@/lib/moments-back';
import { askChoice } from '@/components/ui/ChoiceSheet';

const GRID_PAD = 14;
const GRID_GAP = 6;

/**
 * The grid for this screen width (read live: folds, tablets, rotation): 3 across on a
 * phone, 5 on a tablet or an unfolded phone, tiles portrait like the photos themselves.
 */
function gridFor(width: number) {
  const cols = width >= 700 ? 5 : 3;
  const tile = Math.floor((width - GRID_PAD * 2 - GRID_GAP * (cols - 1)) / cols);
  return { cols, tile, tileH: Math.round(tile * (4 / 3)) };
}
/** The album cover band's height below the status bar. */
const ALBUM_HERO_H = 250;
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
  | { kind: 'create'; pendingIds: string[] | null; back?: SheetState }
  | { kind: 'rename'; album: MomentAlbum }
  | { kind: 'picker' }
  | { kind: 'place'; place: MomentPlace; back?: SheetState }
  | {
      kind: 'actions';
      title: string;
      subtitle?: string;
      message?: string;
      thumb?: React.ReactNode;
      actions: SheetAction[];
      primary?: { label: string; color?: string; icon?: IconName; onPress: () => void };
    }
  | null;

function toRows(key: string, label: string, moments: Moment[], withHeader: boolean, cols: number): HistoryRow[] {
  const out: HistoryRow[] = [];
  if (withHeader) out.push({ kind: 'header', key: `h-${key}`, label, count: moments.length });
  for (let i = 0; i < moments.length; i += cols) {
    out.push({
      kind: 'tiles',
      key: `r-${key}-${i}`,
      moments: moments.slice(i, i + cols),
      sectionMoments: moments,
      sectionLabel: label,
      lastInSection: i + cols >= moments.length,
    });
  }
  return out;
}

export function MomentHistoryModal() {
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W } = useWindowDimensions();
  const { cols: COLS, tile: TILE, tileH: TILE_H } = gridFor(SCREEN_W);
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
  const relationship = useRelationshipStore((s) => s.relationship);
  const queryClient = useQueryClient();
  const uploadJobs = useAlbumUploadStore((s) => s.jobs);
  const { limits, dailyMomentsUsed } = useSubscription();
  const { isPlus, requirePlus } = usePlusGate();
  const { albums, createAlbum, addMoments, removeMoment, pruneMoments, setCover, updateAlbum, deleteAlbum } =
    useMomentAlbums();
  const { store: placesStore, namePlace } = useMomentPlaces();

  const [selecting, setSelecting] = useState(false);
  /** Set while picking moments for one album (after "New album" or "Add moments"). */
  const [addTarget, setAddTarget] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllEngaged, setSelectAllEngaged] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  // Whether an album's cover is still behind the status bar (white icons on it).
  const [heroBehindStatus, setHeroBehindStatus] = useState(true);
  const viewerOpen = useUIStore((s) => !!s.momentViewer);
  // A newly opened album starts scrolled to the top, cover behind the status bar.
  const [heroAlbumId, setHeroAlbumId] = useState(albumId);
  if (heroAlbumId !== albumId) {
    setHeroAlbumId(albumId);
    setHeroBehindStatus(true);
  }
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
  const places = useMemo(() => groupMomentsIntoPlaces(allMoments, placesStore), [allMoments, placesStore]);

  const albumMoments = useMemo(
    () => (openAlbum ? openAlbum.momentIds.map((id) => momentsById.get(id)).filter((m): m is Moment => !!m) : []),
    [openAlbum, momentsById],
  );

  const lockedCount = Math.max(0, allMoments.length - displayMoments.length);
  const rows = useMemo(
    () =>
      groupMomentsForHistory(displayMoments).flatMap((section) =>
        toRows(section.key, section.label, section.moments, true, COLS),
      ),
    [displayMoments, COLS],
  );
  const albumRows = useMemo(
    () => (openAlbum ? toRows(openAlbum.id, openAlbum.name, albumMoments, false, COLS) : []),
    [openAlbum, albumMoments, COLS],
  );

  // Free accounts still page in until they've loaded enough to fill their
  // limit (and to know how many more are locked); Plus loads everything.
  const wantsMore = !Number.isFinite(limits.timelineMoments) || allMoments.length < limits.timelineMoments;
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

  // Closed: leave selection and sheets behind for next time (while rendering, once per close).
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (!visible) {
      setSelecting(false);
      setAddTarget(null);
      setSelectedIds(new Set());
      setSelectAllEngaged(false);
      setDownloading(false);
      setDeleting(false);
      setSheet(null);
    }
  }
  useEffect(() => {
    if (!visible) longPressLockRef.current = false;
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
    useUIStore.setState({ momentCameraWaking: false });
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

  /**
   * Back to an album you were just in (after picking moments for it): it's
   * already "open", so it appears in place. Only a real open slides in from the
   * right; replaying that here flashed Our moments first.
   */
  const levelInstantRef = useRef(false);
  const backToAlbum = (id: string) => {
    levelInstantRef.current = true;
    setAlbumId(id);
  };

  /** Cancel in "add to album" mode goes back to that album. */
  const cancelSelection = () => {
    const target = addTarget;
    exitSelection();
    if (target) backToAlbum(target);
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
    setSheet({
      kind: 'actions',
      title: openAlbum.name,
      actions: [
        {
          label: 'Make album cover',
          icon: 'image',
          onPress: () => {
            setCover(openAlbum.id, moment.id);
            setSheet(null);
          },
        },
        {
          label: 'Remove from album',
          icon: 'trash',
          destructive: true,
          onPress: () => {
            removeMoment(openAlbum.id, moment.id);
            setSheet(null);
          },
        },
      ],
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
    setAlbumId(null);
    setMapOpen(false);
    close();
    setShowMomentCreator(true);
  };

  // ── Albums ────────────────────────────────────────────────────────────

  /** Free accounts get FREE_ALBUM_LIMIT albums; the next one opens the paywall. */
  // Plus opens as its own full-screen layer, which can't appear over Moments on
  // iPhone; so Moments steps aside first, then Plus opens.
  // Plus opens right here, over History (Moments draws it), headed with the feature that
  // was hit; closing it brings you back to your albums.
  const openPlus = (reason: string) => {
    setSheet(null);
    requirePlus(reason);
  };
  const canCreateAlbum = () => {
    if (isPlus || albums.length < FREE_ALBUM_LIMIT) return true;
    setSheet({
      kind: 'actions',
      title: 'Unlimited albums',
      message: `Free accounts can keep ${FREE_ALBUM_LIMIT} albums. With Moments Plus you can make as many as you like.`,
      thumb: (
        <View style={[styles.sheetThumbIcon, { backgroundColor: chrome.accentSoft }]}>
          <Icon name="albums" size={26} color={chrome.accent} filled />
        </View>
      ),
      actions: [],
      // Brand coral: the upgrade reads as Moments Plus whatever the theme.
      primary: { label: 'Unlock unlimited albums', color: '#FF4D6D', icon: 'unlock', onPress: () => openPlus('Unlimited albums') },
    });
    return false;
  };

  /** `back`: the sheet to return to if the page is closed without creating (e.g. Add to album). */
  const startNewAlbum = (pendingIds: string[] | null = null, back?: SheetState) => {
    if (!canCreateAlbum()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheet({ kind: 'create', pendingIds, back });
  };

  // Uploads into albums are moments too, so the free plan's daily moments cap them (counting
  // any still uploading). Plus is unlimited.
  const uploading = Object.values(uploadJobs).reduce((n, j) => n + (j.total - j.done - j.failed), 0);
  const uploadsLeft = isPlus ? Infinity : Math.max(0, limits.dailyMoments - dailyMomentsUsed - uploading);

  const showMomentLimit = () =>
    setSheet({
      kind: 'actions',
      title: 'Unlimited daily moments',
      message: `Free accounts can add ${limits.dailyMoments} moments a day, and you’ve used today’s. With Moments Plus you can upload as many as you like.`,
      thumb: (
        <View style={[styles.sheetThumbIcon, { backgroundColor: chrome.accentSoft }]}>
          <Icon name="image" size={26} color={chrome.accent} filled />
        </View>
      ),
      actions: [],
      primary: {
        label: 'Unlock unlimited moments',
        color: '#FF4D6D',
        icon: 'unlock',
        onPress: () => openPlus('Unlimited daily moments'),
      },
    });

  /** Photos and videos from the phone into an album: they upload in the background. */
  const uploadInto = (album: { id: string; name: string }, picked: PickedMedia[]) => {
    // Never more than today's free moments left (the picker can't always enforce it).
    const media = Number.isFinite(uploadsLeft) ? picked.slice(0, uploadsLeft) : picked;
    if (media.length === 0) {
      showMomentLimit();
      return;
    }
    if (media.length < picked.length) {
      Alert.alert(
        `Adding ${media.length} of ${picked.length}`,
        `Free accounts can add ${limits.dailyMoments} moments a day. Get Moments Plus to upload the rest.`,
      );
    }
    void uploadToAlbum({
      albumId: album.id,
      albumName: album.name,
      media,
      addMoments,
      onMomentCreated: () => void queryClient.invalidateQueries({ queryKey: ['moments', relationship?.id] }),
    }).then(({ added, failed }) => {
      if (added > 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (failed > 0) {
        Alert.alert(
          'Some didn’t upload',
          `${failed} of ${added + failed} couldn’t be added. Check your connection and try those again.`,
        );
      }
    });
  };

  const uploadFromLibrary = async (album: { id: string; name: string }) => {
    if (uploadsLeft <= 0) {
      showMomentLimit();
      return;
    }
    const media = await pickAlbumMedia(Math.min(ALBUM_UPLOAD_MAX, uploadsLeft));
    if (media.length) uploadInto(album, media);
  };

  const onCreateAlbum = ({
    name,
    emoji,
    media,
    momentIds,
  }: {
    name: string;
    emoji: string;
    media?: PickedMedia[];
    /** Moments picked on the New album page ("Add from your moments"). */
    momentIds?: string[];
  }) => {
    const pending = sheet?.kind === 'create' ? sheet.pendingIds : null;
    setSheet(null);
    if (pending?.length) {
      // From select mode: the album is born with the picked moments.
      const album = createAlbum({ name, emoji, momentIds: [...new Set([...pending, ...(momentIds ?? [])])] });
      exitSelection();
      backToAlbum(album.id);
      if (media?.length) uploadInto(album, media);
      return;
    }
    // From "New album": create it (with any moments picked) and open it; anything picked from
    // the phone uploads into it.
    const album = createAlbum({ name, emoji, momentIds: momentIds?.length ? momentIds : undefined });
    backToAlbum(album.id);
    if (media?.length) uploadInto(album, media);
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
    backToAlbum(target);
  };

  const addSelectionToAlbum = (album: MomentAlbum) => {
    addMoments(album.id, [...selectedIds]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSheet(null);
    exitSelection();
    backToAlbum(album.id);
  };

  const albumMenu = () => {
    if (!openAlbum) return;
    const coverId = openAlbum.coverMomentId ?? openAlbum.momentIds[0];
    const cover = coverId ? momentsById.get(coverId) : undefined;
    const count = albumMoments.length;
    setSheet({
      kind: 'actions',
      title: openAlbum.name,
      subtitle: `${count} moment${count === 1 ? '' : 's'}`,
      thumb: cover ? (
        <MomentTile moment={cover} width={52} height={52} />
      ) : (
        <View style={[styles.sheetThumbIcon, { backgroundColor: chrome.accentSoft }]}>
          <Icon name={markIcon(openAlbum.emoji, 'albums')} size={26} color={chrome.accent} filled />
        </View>
      ),
      actions: [
        {
          label: 'Add from your moments',
          icon: 'plus',
          onPress: () => {
            setSheet(null);
            startAddingToOpenAlbum();
          },
        },
        {
          label: 'Upload photos & videos',
          icon: 'image',
          onPress: () => {
            setSheet(null);
            void uploadFromLibrary(openAlbum);
          },
        },
        { label: 'Edit album', icon: 'edit', onPress: () => setSheet({ kind: 'rename', album: openAlbum }) },
        {
          label: 'Delete album',
          icon: 'trash',
          destructive: true,
          onPress: () =>
            setSheet({
              kind: 'actions',
              title: 'Delete this album?',
              message: 'The moments stay in your history. Only the album goes.',
              actions: [
                {
                  label: 'Delete album',
                  icon: 'trash',
                  destructive: true,
                  onPress: () => {
                    setSheet(null);
                    deleteAlbum(openAlbum.id);
                    setAlbumId(null);
                  },
                },
              ],
            }),
        },
      ],
    });
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

    askChoice({ title: 'Delete moments?', message: message, actions: [
{ label: 'Delete', destructive: true, onPress: () => {
          void (async () => {
            setDeleting(true);
            try {
              await deleteMomentsMutation.mutateAsync(ownedSelectedIds);
              pruneMoments(ownedSelectedIds);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              exitSelection();
            } catch (error) {
              Alert.alert('Could not delete', toUserFacingNetworkError(error, 'Please try again.').message);
            } finally {
              setDeleting(false);
            }
          })();
        } },
] });
  };

  // Swipe right anywhere: back out of an album / the map, otherwise close History.
  // Only claims clearly horizontal drags, so the grid still scrolls.
  // Two positions: History as a whole (rootX) and the album / map page on top
  // of Our moments (levelX), so closing one never makes the other jump.
  const rootX = useSharedValue(0);
  const levelX = useSharedValue(0);
  const subLevel = useSharedValue(false);
  const onLevel = inAlbum || inMap;
  useEffect(() => {
    subLevel.set(onLevel);
    // An album or the map slides in from the right, like a pushed page
    // (but coming back from picking moments, the album is just there).
    if (onLevel) {
      if (levelInstantRef.current) {
        levelInstantRef.current = false;
        levelX.set(0);
        return;
      }
      levelX.set(SCREEN_W);
      levelX.set(withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) }));
    }
    // Slides in when an album / the map opens (not again when the screen size changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLevel, subLevel, levelX]);

  const closeLevel = () => {
    setAlbumId(null);
    setMapOpen(false);
  };
  /** Back arrow on an album / the map: slide it away, then drop it (Our moments is already there). */
  const backFromLevel = () => {
    Haptics.selectionAsync();
    levelX.set(
      withTiming(SCREEN_W, { duration: 220, easing: Easing.out(Easing.quad) }, (done) => {
        if (done) runOnJS(closeLevel)();
      }),
    );
  };
  const onSwipedAway = () => dismiss();
  const sleepCamera = () => useUIStore.setState({ momentCameraWaking: false });
  /** About to reveal the camera underneath: start it now instead of after History is gone. */
  const wakeCamera = () => {
    if (returnToCamera) useUIStore.setState({ momentCameraWaking: true });
  };

  useMomentsBack(MOMENTS_BACK.history, visible, () => {
    if (sheet) setSheet(sheet.kind === 'create' ? (sheet.back ?? null) : null);
    else if (selecting) cancelSelection();
    else if (albumId || mapOpen) backFromLevel();
    else dismiss();
  });

  const swipeClose = Gesture.Pan()
    // Anywhere on Our map too: the map itself keeps its own pans, and a strip
    // along its left edge (in OurMapView) lets the swipe start over it.
    .enabled(!selecting && !sheet)
    .activeOffsetX(12)
    .failOffsetX(-8)
    .failOffsetY([-16, 16])
    .onStart(() => {
      if (!subLevel.value) runOnJS(wakeCamera)();
    })
    .onUpdate((e) => {
      const x = Math.max(0, e.translationX);
      if (subLevel.value) levelX.set(x);
      else rootX.set(x);
    })
    .onEnd((e) => {
      const away = e.translationX > DISMISS_DISTANCE || e.velocityX > DISMISS_VELOCITY;
      if (subLevel.value) {
        levelX.set(
          withSpring(away ? SCREEN_W : 0, { ...SETTLE_SPRING, velocity: e.velocityX }, (done) => {
            if (done && away) runOnJS(closeLevel)();
          }),
        );
        return;
      }
      rootX.set(
        withSpring(away ? SCREEN_W : 0, { ...SETTLE_SPRING, velocity: e.velocityX }, (done) => {
          if (done && away) runOnJS(onSwipedAway)();
          // Let go early: History stays, so the camera can rest again.
          if (done && !away) runOnJS(sleepCamera)();
        }),
      );
    });
  const rootStyle = useAnimatedStyle(() => ({ transform: [{ translateX: rootX.value }] }));
  const levelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: levelX.value }] }));
  // Like a native back swipe (Notifications): Our moments waits underneath, a
  // little to the left and dimmed, and slides into place with the page on top.
  const baseStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: subLevel.value ? -SCREEN_W * 0.3 * (1 - Math.min(1, levelX.value / SCREEN_W)) : 0 }],
  }));
  const dimStyle = useAnimatedStyle(() => ({
    opacity: subLevel.value ? 0.22 * (1 - Math.min(1, levelX.value / SCREEN_W)) : 0,
  }));

  const selectionCount = selectedIds.size;
  const bottomPad = selecting ? insets.bottom + 118 : insets.bottom + 88;

  /** One row of the grid (a month heading or three tiles); long-press differs inside an album. */
  const rowContent = (item: HistoryRow, inAlbumList: boolean) => {
    if (item.kind === 'header') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionLabel, { color: chrome.text }]}>{item.label}</Text>
          <View style={[styles.sectionPill, cardSurface(colors)]}>
            <Text style={[styles.sectionCount, { color: chrome.textSecondary }]}>{item.count}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={[styles.grid, item.lastInSection && styles.gridSectionEnd]}>
        {item.moments.map((moment) => (
          <View key={moment.id} style={{ width: TILE }}>
            <MomentTile
              moment={moment}
              width={TILE}
              height={TILE_H}
              selecting={selecting}
              selected={selectedIds.has(moment.id)}
              reactionBadge={selecting ? null : getHistoryReactionBadge(moment, user?.id ?? '', partner?.id)}
              onPress={() => onTilePress(moment, item.sectionMoments, item.sectionLabel)}
              onLongPress={() => (inAlbumList ? albumMomentOptions(moment) : enterSelection(moment.id))}
            />
          </View>
        ))}
      </View>
    );
  };

  const renderRow = ({ item }: { item: HistoryRow }) => rowContent(item, false);
  const renderAlbumRow = ({ item }: { item: HistoryRow }) => rowContent(item, true);

  // ── Header (one row: left icon · centered title · right icon) ─────────

  let headerLeft: React.ReactNode;
  let headerTitle: string;
  let headerRight: React.ReactNode;
  if (selecting) {
    headerLeft = <HeaderIconButton icon="close" onPress={cancelSelection} accessibilityLabel="Cancel selection" />;
    headerTitle = targetAlbum ? `Add to ${targetAlbum.name}` : `${selectionCount} selected`;
    headerRight = (
      <Pressable
        onPress={toggleSelectAll}
        hitSlop={12}
        style={[
          styles.selectAllBtn,
          cardSurface(colors),
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

  // An open album starts with its cover, big, like Photos: the cover photo fading to
  // dark at the bottom, with the album's icon, name, size and the span of dates it covers.
  const albumCover = openAlbum ? momentsById.get(albumCoverId(openAlbum) ?? '') : undefined;
  const albumSpan = (() => {
    if (albumMoments.length === 0) return null;
    const times = albumMoments.map((m) => new Date(m.created_at).getTime());
    const first = format(Math.min(...times), 'MMM yyyy');
    const last = format(Math.max(...times), 'MMM yyyy');
    return first === last ? first : `${first} – ${last}`;
  })();
  // The album's cover is the top of its page, like the Streak and You pages: edge to edge,
  // up under the status bar, curved at the bottom. No photo yet: the theme's accent.
  const coverPhoto = albumCover?.media_url && albumCover.type === 'photo' ? albumCover.media_url : null;
  const heroHeight = insets.top + ALBUM_HERO_H;
  // No photo: the theme's hero colour with its own text colour (as on Home, You and Streak),
  // so it reads on every theme. Over a photo: white on a darkened image.
  const plainBand = introBand(colors);
  const heroBg = coverPhoto ? '#000000' : plainBand.background;
  const heroInk = coverPhoto ? '#FFFFFF' : plainBand.ink;
  const heroLightIcons = coverPhoto ? true : plainBand.isDark;
  const albumHero = openAlbum ? (
    <View style={[styles.albumHeroWrap, { height: heroHeight }]}>
      {/* Fills the space above when you pull down, so the top never shows a gap. */}
      <View
        pointerEvents="none"
        style={[styles.albumHeroBleed, { backgroundColor: heroBg }]}
      />
      <View style={[styles.albumHero, { backgroundColor: heroBg }]}>
        {coverPhoto ? (
          <Image source={mediaSource(coverPhoto)} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : null}
        {/* Over a photo: darkens the top for the status bar and buttons, and the bottom for the name. */}
        {coverPhoto ? (
          <LinearGradient
            colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.62)']}
            locations={[0, 0.3, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.albumHeroText}>
          <View style={[styles.albumHeroBadge, { backgroundColor: colorWithAlpha(heroInk, 0.2) }]}>
            <Icon name={markIcon(openAlbum.emoji, 'albums')} size={18} color={heroInk} filled />
          </View>
          <Text style={[styles.albumHeroName, { color: heroInk }]} numberOfLines={1}>
            {openAlbum.name}
          </Text>
          <Text style={[styles.albumHeroMeta, { color: colorWithAlpha(heroInk, 0.85) }]} numberOfLines={1}>
            {albumMoments.length} moment{albumMoments.length === 1 ? '' : 's'}
            {albumSpan ? ` · ${albumSpan}` : ''}
          </Text>
        </View>
      </View>
    </View>
  ) : null;

  const emptyAll = !isLoading && displayMoments.length === 0;

  // "Add" in an album: moments you've already sent, or new ones from the phone.
  const addToAlbumMenu = () => {
    if (!openAlbum) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheet({
      kind: 'actions',
      title: `Add to ${openAlbum.name}`,
      // Moments you've shared first (what an album is mostly made of), then new ones from the phone.
      actions: [
        {
          label: 'Add from your moments',
          icon: 'albums',
          onPress: () => {
            setSheet(null);
            startAddingToOpenAlbum();
          },
        },
        {
          label: 'Upload photos & videos',
          icon: 'image',
          onPress: () => {
            setSheet(null);
            void uploadFromLibrary(openAlbum);
          },
        },
      ],
    });
  };
  const uploadJob = openAlbum ? uploadJobs[openAlbum.id] : undefined;
  const uploadBanner = uploadJob ? (
    <View style={[styles.uploadBanner, cardSurface(colors)]}>
      <ActivityIndicator size="small" color={chrome.accent} />
      <View style={styles.uploadText}>
        <Text style={[styles.uploadTitle, { color: chrome.text }]}>
          Uploading {Math.min(uploadJob.total, uploadJob.done + uploadJob.failed + 1)} of {uploadJob.total}…
        </Text>
        <View style={[styles.uploadTrack, { backgroundColor: chrome.border }]}>
          <View
            style={[
              styles.uploadFill,
              {
                backgroundColor: chrome.accent,
                width: `${Math.round(((uploadJob.done + uploadJob.failed) / uploadJob.total) * 100)}%`,
              },
            ]}
          />
        </View>
      </View>
    </View>
  ) : null;

  return (
    <GestureDetector gesture={swipeClose}>
      <Animated.View style={[styles.root, { backgroundColor: chrome.background }, rootStyle]}>
        {/* Our moments: always here, underneath an album or the map. */}
        <Animated.View
          style={[styles.root, { paddingTop: insets.top }, baseStyle]}
          pointerEvents={onLevel ? 'none' : 'auto'}>
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
          ) : emptyAll ? (
            <View style={styles.centered}>
              <View style={[styles.emptyIcon, cardSurface(colors)]}>
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
              extraData={[selecting, selectedIds]}
              onScroll={onScroll}
              scrollEventThrottle={32}
              onEndReached={loadMore}
              onEndReachedThreshold={0.6}
              initialNumToRender={8}
              windowSize={7}
              removeClippedSubviews
              contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                !selecting ? (
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
              ListFooterComponent={
                <>
                  {lockedCount > 0 && (
                    <Pressable
                      onPress={() => openPlus('Full moment history')}
                      style={[styles.unlockBanner, cardSurface(colors)]}>
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
          ) : !emptyAll && !isLoading ? (
            <FloatingButton
              icon="albums"
              label="New album"
              onPress={() => startNewAlbum()}
              bottomInset={insets.bottom}
            />
          ) : null}
        </Animated.View>

        {onLevel ? (
          <>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} />
            {/* The album or the map: a page of its own, on top of Our moments. */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                styles.layer,
                { paddingTop: inAlbum ? 0 : insets.top, backgroundColor: chrome.background },
                levelStyle,
              ]}>
              {/* White status bar icons while the cover is behind them (not under an open moment). */}
              {inAlbum && !viewerOpen ? <ThemedStatusBar style={heroBehindStatus ? (heroLightIcons ? 'light' : 'dark') : undefined} /> : null}
              {inMap ? (
              <View style={styles.header}>
                <View style={[styles.side, styles.sideLeft]}>
                  <HeaderIconButton
                    icon="chevronLeft"
                    onPress={backFromLevel}
                    accessibilityLabel="Back to all moments"
                  />
                </View>
                <View style={styles.center}>
                  <Text style={[styles.title, { color: chrome.text }]} numberOfLines={1}>
                    Our map
                  </Text>
                </View>
                <View style={[styles.side, styles.sideRight]} />
              </View>
              ) : null}

              {inMap ? (
                <OurMapView
                  places={places}
                  bottomInset={insets.bottom}
                  onOpenPlace={(place) => {
                    const first = place.moments[0];
                    if (first) openMoment(first, place.moments, placeTitle(place));
                  }}
                  onNamePlace={(place) => setSheet({ kind: 'place', place })}
                />
              ) : (
                <>
                  <FlatList
                    data={albumRows}
                    keyExtractor={(row) => row.key}
                    renderItem={renderAlbumRow}
                    ListHeaderComponent={
                      <>
                        {albumHero}
                        {uploadBanner}
                      </>
                    }
                    onScroll={(e) => {
                      const behind = e.nativeEvent.contentOffset.y < heroHeight - insets.top - 24;
                      if (behind !== heroBehindStatus) setHeroBehindStatus(behind);
                    }}
                    scrollEventThrottle={32}
                    // The cover is pinned to the top: no pulling the page down past it.
                    bounces={false}
                    overScrollMode="never"
                    initialNumToRender={8}
                    contentContainerStyle={[
                      styles.scroll,
                      { paddingBottom: insets.bottom + 88 },
                      albumRows.length === 0 && styles.scrollFill,
                    ]}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                      <View style={styles.albumEmpty}>
                        <View style={[styles.emptyIcon, { backgroundColor: chrome.accentSoft }]}>
                          <Icon name={markIcon(openAlbum?.emoji, 'albums')} size={34} color={chrome.accent} filled />
                        </View>
                        <Text style={[styles.emptyTitle, { color: chrome.text }]}>Nothing in here yet</Text>
                        <Text style={[styles.emptySub, { color: chrome.textSecondary }]}>
                          Add moments you want to keep together.
                        </Text>
                      </View>
                    }
                  />
                  <FloatingButton
                    icon="plus"
                    label="Add to moments"
                    onPress={addToAlbumMenu}
                    bottomInset={insets.bottom}
                  />
                  {/* Back and options float over the cover (and stay put as you scroll). */}
                  <View pointerEvents="box-none" style={[styles.albumChips, { top: insets.top + 6 }]}>
                    {[
                      { icon: 'chevronLeft' as const, label: 'Back to all moments', onPress: backFromLevel },
                      { icon: 'more' as const, label: 'Album options', onPress: albumMenu },
                    ].map((chip) => (
                      <Pressable
                        key={chip.icon}
                        onPress={chip.onPress}
                        accessibilityRole="button"
                        accessibilityLabel={chip.label}
                        hitSlop={6}
                        style={({ pressed }) => [
                          styles.albumChip,
                          { backgroundColor: colorWithAlpha('#FFFFFF', 0.78) },
                          pressed && { opacity: 0.8 },
                        ]}>
                        <Icon name={chip.icon} size={24} color="#1A1A1A" />
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </Animated.View>
          </>
        ) : null}

        {sheet?.kind === 'create' ? (
          <AlbumEditSheet
            title="New album"
            submitLabel="Create album"
            withMedia
            mediaLimit={Number.isFinite(uploadsLeft) ? uploadsLeft : undefined}
            freeDailyMoments={limits.dailyMoments}
            moments={allMoments}
            onSubmit={onCreateAlbum}
            onClose={() => setSheet(sheet.back ?? null)}
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
            icons={PLACE_ICONS}
            initialName={sheet.place.name?.name ?? ''}
            initialEmoji={sheet.place.name?.emoji}
            onSubmit={(value) => {
              namePlace(sheet.place.key, value);
              setSheet(null);
            }}
            onClose={() => setSheet(sheet.back ?? null)}
          />
        ) : sheet?.kind === 'actions' ? (
          <ActionSheet
            title={sheet.title}
            subtitle={sheet.subtitle}
            message={sheet.message}
            thumb={sheet.thumb}
            actions={sheet.actions}
            primary={sheet.primary}
            onClose={() => setSheet(null)}
          />
        ) : sheet?.kind === 'picker' ? (
          <AlbumPickerSheet
            albums={albums}
            count={selectionCount}
            onPick={addSelectionToAlbum}
            onNew={() => startNewAlbum([...selectedIds], { kind: 'picker' })}
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
          cardEdge(colors),
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
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
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
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  sectionLabel: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  sectionPill: { paddingHorizontal: 9, height: 22, borderRadius: 11, justifyContent: 'center' },
  sectionCount: { fontSize: 12, fontWeight: '800' },
  scrollFill: { flexGrow: 1 },
  sheetThumbIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { backgroundColor: '#000' },
  // The album / map page casts a soft edge shadow over Our moments while it's swiped.
  layer: {
    shadowColor: '#000',
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  albumHeroWrap: { marginHorizontal: -GRID_PAD, marginBottom: 18 },
  albumHeroBleed: { position: 'absolute', left: 0, right: 0, top: -600, height: 600 },
  albumHero: {
    flex: 1,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  albumHeroText: { paddingHorizontal: 20, paddingBottom: 22, gap: 3 },
  albumChips: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 20,
    elevation: 20,
  },
  albumChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  albumHeroBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  albumHeroName: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  albumHeroMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700' },
  uploadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 12,
  },
  uploadText: { flex: 1, gap: 6 },
  uploadTitle: { fontSize: 14, fontWeight: '700' },
  uploadTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  uploadFill: { height: 4, borderRadius: 2 },
  albumEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  // Three portrait cards a row, a small even gap all round.
  grid: { flexDirection: 'row', gap: GRID_GAP, marginBottom: GRID_GAP },
  gridSectionEnd: { marginBottom: 26 },
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
