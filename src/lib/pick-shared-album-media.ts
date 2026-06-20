import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export async function pickAndUploadSharedAlbumMedia(
  upload: (payload: {
    uri: string;
    mediaType: 'photo' | 'video';
    fileSizeBytes?: number;
  }) => Promise<unknown>,
  options?: { isPlus?: boolean; storageLimitBytes?: number; usedBytes?: number },
): Promise<{ uploaded: number; failed: number }> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission required', 'Allow access to your photo library in Settings.');
    return { uploaded: 0, failed: 0 };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    quality: 0.85,
    allowsMultipleSelection: true,
    selectionLimit: 20,
    videoMaxDuration: 120,
  });

  if (result.canceled || result.assets.length === 0) {
    return { uploaded: 0, failed: 0 };
  }

  let uploaded = 0;
  let failed = 0;
  let runningUsed = options?.usedBytes ?? 0;
  const limit = options?.storageLimitBytes;

  for (const asset of result.assets) {
    const mediaType = asset.type === 'video' ? 'video' : 'photo';
    let fileSizeBytes = asset.fileSize ?? 0;
    if (!fileSizeBytes) {
      try {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        fileSizeBytes = blob.size;
      } catch {
        fileSizeBytes = 0;
      }
    }

    if (!options?.isPlus && limit && runningUsed + fileSizeBytes > limit) {
      Alert.alert(
        'Storage full',
        'Your shared album has reached the 100 MB limit. Upgrade to Plus for unlimited storage.',
      );
      failed += result.assets.length - uploaded - failed;
      break;
    }

    try {
      await upload({ uri: asset.uri, mediaType, fileSizeBytes });
      runningUsed += fileSizeBytes;
      uploaded += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : 'Upload failed';
      if (message.toLowerCase().includes('storage limit')) {
        Alert.alert('Storage full', 'Your shared album is full. Upgrade to Plus for unlimited storage.');
        break;
      }
    }
  }

  if (uploaded > 0) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return { uploaded, failed };
}
