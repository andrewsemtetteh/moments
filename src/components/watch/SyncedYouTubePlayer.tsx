import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

export type YTPlayerState = 'unstarted' | 'ended' | 'playing' | 'paused' | 'buffering' | 'cued';

export interface SyncedYouTubePlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  loadVideo: (videoId: string) => void;
}

interface Props {
  videoId: string;
  /** Whether the local user can drive the native controls (host). */
  controls?: boolean;
  onReady?: () => void;
  onStateChange?: (state: YTPlayerState, time: number) => void;
  /** Fires ~1x/sec with the player's current time in seconds. */
  onProgress?: (seconds: number, state: YTPlayerState) => void;
}

const STATE_MAP: Record<number, YTPlayerState> = {
  [-1]: 'unstarted',
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
  5: 'cued',
};

function buildHtml(videoId: string, controls: boolean): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>
      html, body { margin: 0; padding: 0; background: #000; height: 100%; overflow: hidden; }
      #player { width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div id="player"></div>
    <script>
      var player; var pollTimer;
      function send(obj) {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      }
      var tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
      function onYouTubeIframeAPIReady() {
        player = new YT.Player('player', {
          videoId: '${videoId}',
          playerVars: { playsinline: 1, controls: ${controls ? 1 : 0}, rel: 0, modestbranding: 1, fs: 0, iv_load_policy: 3 },
          events: {
            onReady: function () {
              send({ event: 'ready' });
              pollTimer = setInterval(function () {
                if (player && player.getCurrentTime) {
                  send({ event: 'time', t: player.getCurrentTime(), s: player.getPlayerState() });
                }
              }, 1000);
            },
            onStateChange: function (e) {
              send({ event: 'state', s: e.data, t: player.getCurrentTime ? player.getCurrentTime() : 0 });
            }
          }
        });
      }
      function handle(ev) {
        try {
          var d = JSON.parse(ev.data);
          if (!player) return;
          if (d.cmd === 'play') player.playVideo();
          else if (d.cmd === 'pause') player.pauseVideo();
          else if (d.cmd === 'seek') player.seekTo(d.t, true);
          else if (d.cmd === 'load') player.loadVideoById(d.id);
        } catch (e) {}
      }
      document.addEventListener('message', handle);
      window.addEventListener('message', handle);
    </script>
  </body>
</html>`;
}

export const SyncedYouTubePlayer = forwardRef<SyncedYouTubePlayerHandle, Props>(function SyncedYouTubePlayer(
  { videoId, controls = false, onReady, onStateChange, onProgress },
  ref,
) {
  const webRef = useRef<WebView>(null);

  const post = (payload: Record<string, unknown>) => {
    const json = JSON.stringify(payload).replace(/'/g, "\\'");
    webRef.current?.injectJavaScript(`handle({ data: '${json}' }); true;`);
  };

  useImperativeHandle(ref, () => ({
    play: () => post({ cmd: 'play' }),
    pause: () => post({ cmd: 'pause' }),
    seekTo: (seconds: number) => post({ cmd: 'seek', t: seconds }),
    loadVideo: (id: string) => post({ cmd: 'load', id }),
  }));

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { event: string; t?: number; s?: number };
      if (data.event === 'ready') {
        onReady?.();
      } else if (data.event === 'time') {
        onProgress?.(data.t ?? 0, STATE_MAP[data.s ?? -1] ?? 'unstarted');
      } else if (data.event === 'state') {
        onStateChange?.(STATE_MAP[data.s ?? -1] ?? 'unstarted', data.t ?? 0);
      }
    } catch {
      // ignore malformed messages
    }
  };

  return (
    <View style={styles.container} pointerEvents={controls ? 'auto' : 'box-none'}>
      <WebView
        ref={webRef}
        source={{ html: buildHtml(videoId, controls) }}
        style={styles.web}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
      />
      {/* Block taps for the non-host so only the host drives playback */}
      {!controls && <View style={StyleSheet.absoluteFill} pointerEvents="auto" />}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 16, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: '#000' },
});
