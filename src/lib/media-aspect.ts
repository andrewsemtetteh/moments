import { Image, type ImageSize } from 'react-native';

import { Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export function fitMediaDimensions(
  aspect: number,
  maxW = SCREEN_W - 32,
  maxH = SCREEN_H * 0.48,
): ImageSize {
  const safeAspect = aspect > 0 ? aspect : 1;
  let width = maxW;
  let height = width / safeAspect;
  if (height > maxH) {
    height = maxH;
    width = height * safeAspect;
  }
  return { width: Math.round(width), height: Math.round(height) };
}

export function getRemoteImageAspect(uri: string): Promise<number> {
  return new Promise((resolve) => {
    Image.getSize(uri, (w, h) => resolve(w / h), () => resolve(1));
  });
}
