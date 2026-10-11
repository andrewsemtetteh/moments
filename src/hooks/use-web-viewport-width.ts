import { useEffect, useState } from 'react';

/**
 * `useWindowDimensions()` can report a stale width on the first client render of
 * these web-only screens (an Expo Router web hydration quirk) until a real
 * `resize` event fires, which broke desktop layouts into their narrow-screen
 * variant. This reads `window.innerWidth` directly and re-measures once on
 * mount, so it's correct immediately instead of only after the user resizes.
 */
export function useWebViewportWidth(): number {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );

  useEffect(() => {
    const measure = () => setWidth(window.innerWidth);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return width;
}
