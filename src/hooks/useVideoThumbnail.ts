import { createVideoPlayer, type VideoThumbnail } from 'expo-video';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getThumbnailAsync } from 'expo-video-thumbnails';

import { mediaSource, videoPosterUrl } from '@/lib/storage-cdn';

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

/** Frames for the Our moments tiles (a picture file, read straight from the video's link). */
const tileFrames = new Map<string, { uri: string }>();
const tileFramesPending = new Map<string, Promise<{ uri: string } | null>>();

function loadTileFrame(uri: string): Promise<{ uri: string } | null> {
  const existing = tileFramesPending.get(uri);
  if (existing) return existing;
  const job = runQueued(async () => {
    try {
      // A moment in (past a black first frame); a very short clip falls back to its start.
      for (const time of [400, 0]) {
        try {
          const frame = await getThumbnailAsync(uri, { time, quality: 0.7 });
          tileFrames.set(uri, { uri: frame.uri });
          return { uri: frame.uri };
        } catch {
          // Try the next time.
        }
      }
      return null;
    } finally {
      tileFramesPending.delete(uri);
    }
  });
  tileFramesPending.set(uri, job);
  return job;
}

/**
 * The picture on a video tile in Our moments: the still saved with the video at upload, or — for
 * older videos without one (the server says 404) — a real frame read from the video.
 * Spread `onError` onto the Image so a missing still switches over.
 */
export function useVideoTileSource(uri: string | null | undefined) {
  const poster = videoPosterUrl(uri);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [, setReady] = useState(0);
  const usePhoneFrame = !!uri && (!poster || failedFor === uri);

  useEffect(() => {
    if (!usePhoneFrame || !uri || Platform.OS === 'web' || tileFrames.has(uri)) return;
    let alive = true;
    void loadTileFrame(uri).then((frame) => {
      if (alive && frame) setReady((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [uri, usePhoneFrame]);

  const source = !uri ? null : usePhoneFrame ? (tileFrames.get(uri) ?? null) : mediaSource(poster!);
  return {
    source,
    onError: () => {
      if (uri && !usePhoneFrame) setFailedFor(uri);
    },
  };
}
