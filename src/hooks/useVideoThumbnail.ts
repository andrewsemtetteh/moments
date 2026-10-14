import { createVideoPlayer, type VideoThumbnail } from 'expo-video';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** One frame per video, kept for the session (grids re-render a lot). */
const cache = new Map<string, VideoThumbnail>();
const pending = new Map<string, Promise<VideoThumbnail | null>>();

/** Only a couple at a time: each one briefly opens the video. */
const MAX_ACTIVE = 2;
let active = 0;
const queue: (() => void)[] = [];

function runQueued<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      active += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          queue.shift()?.();
        });
    };
    if (active < MAX_ACTIVE) start();
    else queue.push(start);
  });
}

function loadThumbnail(uri: string, maxWidth: number): Promise<VideoThumbnail | null> {
  const existing = pending.get(uri);
  if (existing) return existing;
  const job = runQueued(async () => {
    const player = createVideoPlayer(uri);
    try {
      player.muted = true;
      const [frame] = await player.generateThumbnailsAsync([0.4], { maxWidth });
      if (frame) cache.set(uri, frame);
      return frame ?? null;
    } catch {
      return null;
    } finally {
      player.release();
      pending.delete(uri);
    }
  });
  pending.set(uri, job);
  return job;
}

/**
 * A still frame for a video tile, so grids show a picture instead of mounting a
 * full video player per tile (which made History slow to fill in).
 * Null until it's ready (and on web, where it isn't supported).
 */
export function useVideoThumbnail(uri: string | null | undefined, maxWidth = 360): VideoThumbnail | null {
  // Bumped when a frame arrives, so the cache read below re-runs.
  const [, setReady] = useState(0);

  useEffect(() => {
    if (!uri || Platform.OS === 'web' || cache.has(uri)) return;
    let alive = true;
    void loadThumbnail(uri, maxWidth).then((frame) => {
      if (alive && frame) setReady((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [uri, maxWidth]);

  return uri ? (cache.get(uri) ?? null) : null;
}
