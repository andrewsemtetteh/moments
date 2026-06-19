import { cacheDirectory, downloadAsync } from 'expo-file-system/legacy';
import { Alert, Platform, Share } from 'react-native';

async function saveToGallery(uri: string, isVideo: boolean): Promise<boolean> {
  try {
    const MediaLibrary = await import('expo-media-library');
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to save moments.');
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
    const ext = isVideo ? 'mp4' : 'jpg';
    const dest = `${cacheDirectory}moment-${Date.now()}.${ext}`;
    const result = await downloadAsync(url, dest);
    return await saveToGallery(result.uri, isVideo);
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
    const ext = isVideo ? 'mp4' : 'jpg';
    const dest = `${cacheDirectory}moment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const result = await downloadAsync(url, dest);
    return saveToGalleryQuiet(result.uri, isVideo);
  } catch {
    return false;
  }
}

async function saveToGalleryQuiet(uri: string, isVideo: boolean): Promise<boolean> {
  try {
    const MediaLibrary = await import('expo-media-library');
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') return false;
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
