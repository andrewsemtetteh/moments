import { useEffect, useRef } from 'react';

/**
 * Android's back key inside the Moments Modal. While a native Modal is up,
 * Android hands the key to the Modal's `onRequestClose` and BackHandler never
 * hears it, so the camera, History, the viewers and the paywall register here
 * instead, and MomentsModal sends the key to the topmost one.
 */
type Entry = { priority: number; run: () => void };
const entries = new Set<Entry>();

/** Layers, bottom to top. */
export const MOMENTS_BACK = { creator: 1, history: 2, viewer: 3, paywall: 4 } as const;

export function useMomentsBack(priority: number, active: boolean, handler: () => void) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    if (!active) return;
    const entry: Entry = { priority, run: () => latest.current() };
    entries.add(entry);
    return () => {
      entries.delete(entry);
    };
  }, [priority, active]);
}

/** Back key pressed in the Moments Modal: the topmost layer handles it. */
export function handleMomentsBack() {
  let top: Entry | undefined;
  for (const e of entries) if (!top || e.priority >= top.priority) top = e;
  top?.run();
}
