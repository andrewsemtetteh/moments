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
