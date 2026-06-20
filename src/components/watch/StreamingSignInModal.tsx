import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { StreamingPlatformIcon } from '@/components/watch/StreamingPlatformIcon';
import { isStreamingAuthenticatedUrl, isStreamingSignInUrl, setStreamingAuthCached } from '@/lib/streaming-auth';

interface Props {
  visible: boolean;
  platformId: string;
  platformName: string;
  signInUrl: string;
  brandColor: string;
  onAuthenticated: () => void;
  onDismiss?: () => void;
}

export function StreamingSignInModal({
  visible,
  platformId,
  platformName,
  signInUrl,
  brandColor,
  onAuthenticated,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const authenticatedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      authenticatedRef.current = false;
    }
  }, [visible, signInUrl]);

  const handleNav = (nav: Pick<WebViewNavigation, 'url'>) => {
    if (authenticatedRef.current) return;
    const url = nav.url;
    if (!url || isStreamingSignInUrl(url)) return;

    if (isStreamingAuthenticatedUrl(platformId, url)) {
      authenticatedRef.current = true;
      setLoading(false);
      void setStreamingAuthCached(platformId, true);
      onAuthenticated();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onDismiss}>
      <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: '#0d0d0f' }]}>
        <View style={[styles.header, { borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
          <View style={styles.headerLeft}>
            <StreamingPlatformIcon platformId={platformId} size={28} />
            <Text style={styles.headerTitle}>Sign in to {platformName}</Text>
          </View>
          {onDismiss ? (
            <Pressable onPress={onDismiss} hitSlop={12} style={styles.closeBtn}>
              <Text style={styles.closeText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.body}>
          <WebView
            ref={webRef}
            source={{ uri: signInUrl }}
            style={styles.web}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsProtectedMedia
            cacheEnabled
            setSupportMultipleWindows={false}
            userAgent={
              Platform.OS === 'ios'
                ? undefined
                : 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
            }
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onNavigationStateChange={handleNav}
            onShouldStartLoadWithRequest={(req) => {
              handleNav({ url: req.url });
              return true;
            }}
          />

          {loading && (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={brandColor} />
              <Text style={styles.loadingText}>Loading {platformName}…</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  closeBtn: { paddingHorizontal: 4, paddingVertical: 6 },
  closeText: { color: 'rgba(255,255,255,0.55)', fontWeight: '700', fontSize: 15 },
  body: { flex: 1, backgroundColor: '#000' },
  web: { flex: 1, backgroundColor: '#000' },
  loading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0d0d0f',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
