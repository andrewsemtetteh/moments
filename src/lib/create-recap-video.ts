import { cacheDirectory, downloadAsync, getInfoAsync, makeDirectoryAsync } from 'expo-file-system/legacy';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import { signMomentsMediaUrl } from '@/lib/moment-media';
import type { Moment } from '@/types/database';

const SLIDE_SECONDS = 2.5;
const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;
const FPS = 30;

const NATIVE_REBUILD_MESSAGE =
  'Recap video requires a native rebuild. Stop Metro, run `npx expo run:android`, then try again.';

export type RecapVideoProgress = {
  phase: 'preparing' | 'encoding';
  current: number;
  total: number;
  message: string;
};

type FfmpegModule = typeof import('ffmpeg-expo');

type FfmpegRunOptions = {
  onProgress?: (progress: { time: number }) => void;
};

function isFfmpegNativeAvailable(): boolean {
  return requireOptionalNativeModule('ExpoFFmpeg') != null;
}

async function loadFfmpeg(): Promise<FfmpegModule> {
  if (Platform.OS === 'web') {
    throw new Error('Recap videos are only supported on iOS and Android.');
  }

  if (!isFfmpegNativeAvailable()) {
    throw new Error(NATIVE_REBUILD_MESSAGE);
  }

  try {
    return await import('ffmpeg-expo');
  } catch {
    throw new Error(NATIVE_REBUILD_MESSAGE);
  }
}

async function runFfmpeg(args: string[], options?: FfmpegRunOptions) {
  const { execute } = await loadFfmpeg();
  return execute(args, options);
}

function toFfmpegPath(uri: string): string {
  return uri.replace(/^file:\/\//, '');
}

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

async function ensureWorkDir(): Promise<string> {
  if (!cacheDirectory) {
    throw new Error('Storage is not available on this device.');
  }
  const workDir = `${cacheDirectory}recap-${Date.now()}/`;
  await makeDirectoryAsync(workDir, { intermediates: true });
  return workDir;
}

async function downloadMedia(url: string, dest: string): Promise<string> {
  const signed = (await signMomentsMediaUrl(url, 'full')) ?? url;
  const result = await downloadAsync(signed, dest);
  return result.uri;
}

async function extractVideoFrame(videoUri: string, frameDest: string): Promise<string> {
  await runFfmpeg([
    '-y',
    '-ss',
    '0',
    '-i',
    toFfmpegPath(videoUri),
    '-vframes',
    '1',
    '-q:v',
    '2',
    toFfmpegPath(frameDest),
  ]);
  return frameDest;
}

async function prepareSlides(
  moments: Moment[],
  workDir: string,
  onProgress: (progress: RecapVideoProgress) => void,
): Promise<string[]> {
  const eligible = moments.filter((moment) => moment.media_url);
  const slides: string[] = [];

  for (let index = 0; index < eligible.length; index += 1) {
    const moment = eligible[index];
    onProgress({
      phase: 'preparing',
      current: index + 1,
      total: eligible.length,
      message: `Preparing ${index + 1} of ${eligible.length}`,
    });

    const sourceExt = moment.type === 'video' ? 'mp4' : 'jpg';
    const sourcePath = `${workDir}source-${index}.${sourceExt}`;
    const localUri = await downloadMedia(moment.media_url!, sourcePath);

    if (moment.type === 'video') {
      const framePath = `${workDir}slide-${index}.jpg`;
      slides.push(await extractVideoFrame(localUri, framePath));
    } else {
      slides.push(localUri);
    }
  }

  return slides;
}

function buildSlideshowArgs(slidePaths: string[], outputPath: string): string[] {
  const count = slidePaths.length;
  if (count === 0) {
    throw new Error('No media to include in recap.');
  }

  const args: string[] = [];
  for (const slide of slidePaths) {
    args.push('-loop', '1', '-t', String(SLIDE_SECONDS), '-i', toFfmpegPath(slide));
  }

  const filterParts: string[] = [];
  const labels: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const label = `v${index}`;
    labels.push(`[${label}]`);
    filterParts.push(
      `[${index}:v]scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease,pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=${FPS}[${label}]`,
    );
  }
  filterParts.push(`${labels.join('')}concat=n=${count}:v=1:a=0[outv]`);

  args.push(
    '-filter_complex',
    filterParts.join(';'),
    '-map',
    '[outv]',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-y',
    toFfmpegPath(outputPath),
  );

  return args;
}

function isFfmpegError(error: unknown): error is { output?: string; returnCode?: number } {
  return typeof error === 'object' && error !== null && 'returnCode' in error;
}

export async function createRecapVideoFromMoments(
  moments: Moment[],
  onProgress?: (progress: RecapVideoProgress) => void,
): Promise<string> {
  if (Platform.OS === 'web') {
    throw new Error('Recap videos are only supported on iOS and Android.');
  }

  const withMedia = moments.filter((moment) => moment.media_url);
  if (withMedia.length === 0) {
    throw new Error('Select at least one photo or video moment.');
  }

  await loadFfmpeg();

  const workDir = await ensureWorkDir();
  const outputPath = `${workDir}recap.mp4`;

  try {
    const slidePaths = await prepareSlides(withMedia, workDir, onProgress ?? (() => undefined));

    onProgress?.({
      phase: 'encoding',
      current: 0,
      total: slidePaths.length,
      message: 'Creating your recap video…',
    });

    const totalMs = slidePaths.length * SLIDE_SECONDS * 1000;
    const args = buildSlideshowArgs(slidePaths, outputPath);

    await runFfmpeg(args, {
      onProgress: (progress) => {
        onProgress?.({
          phase: 'encoding',
          current: Math.min(
            slidePaths.length,
            Math.max(1, Math.round((progress.time / totalMs) * slidePaths.length)),
          ),
          total: slidePaths.length,
          message: 'Creating your recap video…',
        });
      },
    });

    const info = await getInfoAsync(outputPath);
    if (!info.exists) {
      throw new Error('Recap video was not created.');
    }

    return toFileUri(outputPath);
  } catch (error) {
    if (isFfmpegError(error)) {
      throw new Error(error.output?.trim() || 'Could not create recap video.');
    }
    throw error;
  }
}

export function getRecapVideoDurationSeconds(slideCount: number): number {
  return slideCount * SLIDE_SECONDS;
}

export function isRecapVideoSupported(): boolean {
  if (Platform.OS === 'web') return false;
  return isFfmpegNativeAvailable();
}
