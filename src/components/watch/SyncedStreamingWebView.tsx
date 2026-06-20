import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { isStreamingSignInUrl } from '@/lib/streaming-auth';

export type StreamingPlayerState = 'playing' | 'paused' | 'buffering' | 'unknown';

export interface SyncedStreamingWebViewHandle {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  reload: () => void;
}

interface Props {
  url: string;
  platformName: string;
  brandColor?: string;
  controls?: boolean;
  onReady?: () => void;
  onStateChange?: (state: StreamingPlayerState, time: number) => void;
  onProgress?: (seconds: number, state: StreamingPlayerState) => void;
  onNeedsSignIn?: (url: string) => void;
}

const SYNC_INJECT = `
(function () {
  if (window.__momentsWatchSync) return;
  window.__momentsWatchSync = true;

  function send(obj) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    }
  }

  function findVideo() {
    return document.querySelector('video');
  }

  var lastState = '';

  function poll() {
    var v = findVideo();
    if (!v) return;
    var state = v.paused ? 'paused' : (v.readyState < 3 ? 'buffering' : 'playing');
    send({ event: 'time', t: v.currentTime || 0, s: state });
    if (state !== lastState) {
      lastState = state;
      send({ event: 'state', s: state, t: v.currentTime || 0 });
    }
  }

  setInterval(poll, 500);

  function handle(ev) {
    try {
      var d = JSON.parse(ev.data);
      var v = findVideo();
      if (!v) return;
      if (d.cmd === 'play') v.play().catch(function () {});
      else if (d.cmd === 'pause') v.pause();
      else if (d.cmd === 'seek') v.currentTime = d.t;
    } catch (e) {}
  }

  document.addEventListener('message', handle);
  window.addEventListener('message', handle);
  send({ event: 'ready' });
})();
true;
`;

export const SyncedStreamingWebView = forwardRef<SyncedStreamingWebViewHandle, Props>(
  function SyncedStreamingWebView(
    { url, platformName, brandColor = '#fff', controls = false, onReady, onStateChange, onProgress, onNeedsSignIn },
    ref,
  ) {
    const webRef = useRef<WebView>(null);
    const [loading, setLoading] = useState(true);
    const syncInjected = useRef(false);

    const post = (payload: Record<string, unknown>) => {
      const json = JSON.stringify(payload).replace(/'/g, "\\'");
      webRef.current?.injectJavaScript(`handle({ data: '${json}' }); true;`);
    };

    useImperativeHandle(ref, () => ({
      play: () => post({ cmd: 'play' }),
      pause: () => post({ cmd: 'pause' }),
      seekTo: (seconds: number) => post({ cmd: 'seek', t: seconds }),
      reload: () => {
        syncInjected.current = false;
        webRef.current?.reload();
      },
    }));

    const injectSync = () => {
      if (syncInjected.current) return;
      syncInjected.current = true;
      webRef.current?.injectJavaScript(SYNC_INJECT);
    };

    const handleMessage = (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          event: string;
          t?: number;
          s?: StreamingPlayerState;
        };

        if (data.event === 'ready') {
          onReady?.();
        } else if (data.event === 'time') {
          onProgress?.(data.t ?? 0, data.s ?? 'unknown');
        } else if (data.event === 'state') {
          onStateChange?.(data.s ?? 'unknown', data.t ?? 0);
        }
      } catch {
        // ignore malformed messages
      }
    };

    const handleNav = (navUrl: string) => {
      if (isStreamingSignInUrl(navUrl)) {
        onNeedsSignIn?.(navUrl);
      }
    };

    return (
      <View style={styles.container}>
        <WebView
          ref={webRef}
          source={{ uri: url }}
          style={[styles.web, loading && styles.webHidden]}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsProtectedMedia
          allowsFullscreenVideo
          cacheEnabled
          setSupportMultipleWindows={false}
          userAgent={
            Platform.OS === 'ios'
              ? undefined
              : 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
          }
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => {
            setLoading(false);
            injectSync();
          }}
          onNavigationStateChange={(nav) => handleNav(nav.url)}
          onMessage={handleMessage}
          scrollEnabled
          bounces={false}
        />

        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={brandColor} />
            <Text style={styles.loadingText}>Loading {platformName}…</Text>
          </View>
        )}

        {!controls && !loading && <View style={StyleSheet.absoluteFill} pointerEvents="box-none" />}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 420,
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
  },
  web: { flex: 1, backgroundColor: '#000' },
  webHidden: { opacity: 0 },
  loading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0d0d0f',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
