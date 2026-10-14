import { cacheDirectory, deleteAsync, downloadAsync, moveAsync } from 'expo-file-system/legacy';
import { Alert, Platform, Share } from 'react-native';

/** Saving only needs add-only access (Expo Go on Android can't grant full library access). */
async function requestSavePermission() {
  const MediaLibrary = await import('expo-media-library');
  const { status } = await MediaLibrary.requestPermissionsAsync(
    true,
    Platform.OS === 'android' ? ['photo', 'video'] : undefined,
  );
  return { MediaLibrary, granted: status === 'granted' };
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

/**
 * Downloads to a file named for what it really is (the gallery reads the
 * extension, so a PNG or HEIC saved as .jpg can be refused). Throws on a
 * failed download instead of saving an error page.
 */
async function downloadToCache(url: string, isVideo: boolean) {
  const base = `${cacheDirectory}moment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result = await downloadAsync(url, `${base}.tmp`);
  if (result.status < 200 || result.status >= 300) {
    await deleteAsync(result.uri, { idempotent: true });
    throw new Error(`Download failed (${result.status})`);
  }
  const header = Object.entries(result.headers ?? {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? '';
  const type = header.toLowerCase().split(';')[0].trim();
  const ext = EXT_BY_TYPE[type] ?? (isVideo ? 'mp4' : 'jpg');
  const dest = `${base}.${ext}`;
  await moveAsync({ from: result.uri, to: dest });
  return dest;
}

async function saveToGallery(uri: string, isVideo: boolean): Promise<boolean> {
  try {
    const { MediaLibrary, granted } = await requestSavePermission();
    if (!granted) {
      Alert.alert('Permission needed', 'Allow Moments to add to your photos in Settings to save moments.');
      return false;
    }
    await MediaLibrary.saveToLibraryAsync(uri);
    Alert.alert('Saved', isVideo ? 'Video saved to your gallery.' : 'Photo saved to your gallery.');
    return true;
  } catch {
    try {
      await Share.share({
        url: uri,
        message: isVideo ? 'Save this video' : 'Save this photo',
      });
      return true;
    } catch {
      Alert.alert(
        'Could not save',
        'Use a development build for direct gallery saves, or try again from the share sheet.',
      );
      return false;
    }
  }
}

export async function saveLocalMomentMedia(uri: string, isVideo: boolean): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.open(uri, '_blank');
    return true;
  }
  return saveToGallery(uri, isVideo);
}

export async function downloadMomentMedia(url: string, isVideo: boolean): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.open(url, '_blank');
    return true;
  }

  if (!cacheDirectory) {
    Alert.alert('Download unavailable', 'Storage is not available on this device.');
    return false;
  }

  try {
    const file = await downloadToCache(url, isVideo);
    return await saveToGallery(file, isVideo);
  } catch {
    Alert.alert('Download failed', 'Could not download this moment. Please try again.');
    return false;
  }
}

export async function downloadMomentMediaQuiet(url: string, isVideo: boolean): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.open(url, '_blank');
    return true;
  }

  if (!cacheDirectory) return false;

  try {
    const file = await downloadToCache(url, isVideo);
    return saveToGalleryQuiet(file, isVideo);
  } catch {
    return false;
  }
}

async function saveToGalleryQuiet(uri: string, isVideo: boolean): Promise<boolean> {
  try {
    const { MediaLibrary, granted } = await requestSavePermission();
    if (!granted) return false;
    await MediaLibrary.saveToLibraryAsync(uri);
    return true;
  } catch {
    return false;
  }
}

export async function downloadMultipleMomentMedia(
  items: { url: string; isVideo: boolean }[],
): Promise<{ saved: number; failed: number }> {
  if (items.length === 0) return { saved: 0, failed: 0 };

  let saved = 0;
  let failed = 0;

  for (const item of items) {
    const ok = await downloadMomentMediaQuiet(item.url, item.isVideo);
    if (ok) saved += 1;
    else failed += 1;
  }

  if (saved > 0 && failed === 0) {
    Alert.alert('Saved', `${saved} moment${saved === 1 ? '' : 's'} saved to your gallery.`);
  } else if (saved > 0) {
    Alert.alert('Partially saved', `${saved} saved, ${failed} could not be downloaded.`);
  } else {
    Alert.alert('Download failed', 'Could not save the selected moments. Check permissions and try again.');
  }

  return { saved, failed };
}
