import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Alert, Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/**
 * Snapshot a view that's on screen as a PNG file, at the screen's full pixel density (nothing is
 * resized, so it stays sharp). Returns the file's uri, or null if it couldn't be taken.
 */
export async function captureViewAsImage(ref: RefObject<View | null>): Promise<string | null> {
  if (!ref.current) return null;
  try {
    return await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
  } catch (e) {
    console.warn('[share] capture failed', e);
    Alert.alert('Couldn’t make the image', e instanceof Error ? e.message : 'Please try again.');
    return null;
  }
}

/**
 * Open the share sheet with an image file (Instagram, WhatsApp, Messages, Photos…). This is the
 * original call that worked; it's made while the preview is still open, nothing closes first.
 */
export async function shareImageFile(
  uri: string,
  { title, fallbackText }: { title?: string; fallbackText?: string } = {},
) {
  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: title });
    } else {
      await Share.share({ url: uri, message: fallbackText });
    }
  } catch (e) {
    console.warn('[share] share sheet failed', e);
    Alert.alert('Couldn’t share', e instanceof Error ? e.message : 'Please try again.');
  }
}

/** Capture a view and open the share sheet with it, in one go. */
export async function shareViewAsImage(
  ref: RefObject<View | null>,
  options: { title?: string; fallbackText?: string } = {},
) {
  const uri = await captureViewAsImage(ref);
  if (uri) await shareImageFile(uri, options);
}

/** Save an image file to the phone's photos. Returns true when it was saved. */
export async function saveImageToPhotos(uri: string): Promise<boolean> {
  try {
    const MediaLibrary = await import('expo-media-library');
    // Write only: saving doesn't need to read the rest of the library.
    const { status } = await MediaLibrary.requestPermissionsAsync(true);
    if (status !== 'granted') {
      Alert.alert('Allow photo access', 'Moments needs permission to save images to your photos.');
      return false;
    }
    await MediaLibrary.saveToLibraryAsync(uri);
    return true;
  } catch (e) {
    console.warn('[share] save to photos failed, falling back to the share sheet', e);
    // Some runtimes (Expo Go on Android) can't save directly: the share sheet has "Save image".
    await shareImageFile(uri);
    return false;
  }
}
