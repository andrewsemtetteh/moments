import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MomentVideoPlayer } from '@/components/moments/MomentVideoPlayer';
import { Icon } from '@/components/ui/Icon';
import { useDeleteSharedAlbumItem } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { downloadMomentMedia } from '@/lib/download-moment-media';
import { momentChrome } from '@/lib/moment-theme';
import { signSharedAlbumPath } from '@/lib/shared-album-media';
import { toUserFacingNetworkError } from '@/lib/network-error';
import { useAuthStore, useUIStore } from '@/stores';
import type { SharedAlbumItem } from '@/types/database';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export function SharedAlbumViewer() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  const viewer = useUIStore((s) => s.albumViewer);
  const closeAlbumViewer = useUIStore((s) => s.closeAlbumViewer);
  const user = useAuthStore((s) => s.user);
  const deleteItem = useDeleteSharedAlbumItem();
  const [index, setIndex] = useState(viewer?.startIndex ?? 0);
  const listRef = useRef<FlatList<SharedAlbumItem>>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const next = viewableItems[0]?.index;
      if (typeof next === 'number') setIndex(next);
    },
    [],
  );

  if (!viewer) return null;

  const item = viewer.items[index];
  const canDelete = item && user && item.user_id === user.id;

  const close = () => closeAlbumViewer();

  const handleDelete = () => {
    if (!item || !canDelete) return;
    Alert.alert('Remove from album?', 'This deletes the file for both of you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteItem.mutateAsync(item.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              if (viewer.items.length <= 1) {
                close();
                return;
              }
              const nextIndex = Math.min(index, viewer.items.length - 2);
              close();
              useUIStore.getState().openAlbumViewer(
                viewer.items.filter((i) => i.id !== item.id),
                Math.max(0, nextIndex),
                { returnToAlbum: viewer.returnToAlbum, sectionLabel: viewer.sectionLabel },
              );
            } catch (error) {
              Alert.alert('Could not remove', toUserFacingNetworkError(error, 'Try again.').message);
            }
          })();
        },
      },
    ]);
  };

  const handleDownload = async () => {
    if (!item?.storage_path) return;
    const signed = await signSharedAlbumPath(item.storage_path);
    await downloadMomentMedia(signed, item.media_type === 'video');
  };

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={[styles.root, { backgroundColor: '#000', paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable onPress={close} hitSlop={12} style={styles.topBtn}>
            <Icon name="close" size={26} color="#fff" />
          </Pressable>
          <View style={styles.topCenter}>
            {viewer.sectionLabel ? (
              <Text style={styles.sectionLabel} numberOfLines={1}>
                {viewer.sectionLabel}
              </Text>
            ) : null}
            <Text style={styles.counter}>
              {index + 1} / {viewer.items.length}
            </Text>
          </View>
          <Pressable onPress={() => void handleDownload()} hitSlop={12} style={styles.topBtn}>
            <Icon name="download" size={22} color="#fff" />
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={viewer.items}
          horizontal
          pagingEnabled
          initialScrollIndex={viewer.startIndex}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          keyExtractor={(row) => row.id}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item: row }) => (
            <View style={[styles.page, { width: SCREEN_W, height: SCREEN_H - insets.top - 72 }]}>
              {row.media_type === 'video' && row.media_url ? (
                <MomentVideoPlayer uri={row.media_url} width={SCREEN_W} height={SCREEN_H * 0.7} autoPlay />
              ) : row.media_url ? (
                <Image source={{ uri: row.media_url }} style={styles.photo} contentFit="contain" />
              ) : null}
            </View>
          )}
        />

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          {canDelete ? (
            <Pressable onPress={handleDelete} style={styles.deleteBtn}>
              <Icon name="trash" size={18} color={chrome.error} />
              <Text style={[styles.deleteText, { color: chrome.error }]}>Remove</Text>
            </Pressable>
          ) : (
            <Text style={styles.hint}>Added by your partner</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    minHeight: 44,
  },
  topBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topCenter: { flex: 1, alignItems: 'center', gap: 2 },
  sectionLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
  counter: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600' },
  page: { alignItems: 'center', justifyContent: 'center' },
  photo: { width: SCREEN_W, height: '100%' },
  bottomBar: { alignItems: 'center', paddingTop: 8 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  deleteText: { fontSize: 15, fontWeight: '700' },
  hint: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
});
