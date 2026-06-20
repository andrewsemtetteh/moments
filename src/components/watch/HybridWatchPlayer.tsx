import { forwardRef, useImperativeHandle, useRef } from 'react';

import { SyncedYouTubePlayer, type SyncedYouTubePlayerHandle, type YTPlayerState } from '@/components/watch/SyncedYouTubePlayer';
import {
  SyncedStreamingWebView,
  type StreamingPlayerState,
  type SyncedStreamingWebViewHandle,
} from '@/components/watch/SyncedStreamingWebView';
import { getStreamingPlatform } from '@/constants/streaming-platforms';

export type HybridWatchPlayerHandle = SyncedStreamingWebViewHandle & {
  isYouTubeIframe: boolean;
};

interface Props {
  platformId: string;
  youtubeVideoId?: string | null;
  onReady?: () => void;
  onStateChange?: (state: StreamingPlayerState | YTPlayerState, time: number) => void;
  onProgress?: (seconds: number, state?: StreamingPlayerState | YTPlayerState) => void;
}

/** In-app player only — WebView / YouTube iframe. Sign in inside the WebView. */
export const HybridWatchPlayer = forwardRef<HybridWatchPlayerHandle, Props>(
  function HybridWatchPlayer({ platformId, youtubeVideoId, onReady, onStateChange, onProgress }, ref) {
    const platform = getStreamingPlatform(platformId);
    const webRef = useRef<SyncedStreamingWebViewHandle>(null);
    const ytRef = useRef<SyncedYouTubePlayerHandle>(null);
    const useYouTubeIframe = platform.playbackMode === 'youtube_inapp' && !!youtubeVideoId;

    useImperativeHandle(ref, () => ({
      get isYouTubeIframe() {
        return useYouTubeIframe;
      },
      play: () => {
        if (useYouTubeIframe) ytRef.current?.play();
        else webRef.current?.play();
      },
      pause: () => {
        if (useYouTubeIframe) ytRef.current?.pause();
        else webRef.current?.pause();
      },
      seekTo: (s: number) => {
        if (useYouTubeIframe) ytRef.current?.seekTo(s);
        else webRef.current?.seekTo(s);
      },
      reload: () => webRef.current?.reload(),
    }));

    if (useYouTubeIframe) {
      return (
        <SyncedYouTubePlayer
          ref={ytRef}
          videoId={youtubeVideoId!}
          controls
          onReady={onReady}
          onProgress={(t, s) => onProgress?.(t, s)}
          onStateChange={(s, t) => onStateChange?.(s, t)}
        />
      );
    }

    return (
      <SyncedStreamingWebView
        ref={webRef}
        url={platform.watchUrl}
        platformName={platform.name}
        brandColor={platform.brandColor}
        controls
        onReady={onReady}
        onStateChange={onStateChange}
        onProgress={onProgress}
      />
    );
  },
);
