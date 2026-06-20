import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { StreamingPlatformIcon } from '@/components/watch/StreamingPlatformIcon';
import { StreamingSignInModal } from '@/components/watch/StreamingSignInModal';
import {
    SyncedStreamingWebView,
    type StreamingPlayerState,
    type SyncedStreamingWebViewHandle,
} from '@/components/watch/SyncedStreamingWebView';
import { getStreamingPlatform } from '@/constants/streaming-platforms';
import { useTheme } from '@/hooks/useTheme';
import { getStreamingAuthCached, isStreamingAuthenticatedUrl, setStreamingAuthCached } from '@/lib/streaming-auth';

interface Props {
  platformId: string;
  onReady?: () => void;
  onStateChange?: (state: StreamingPlayerState, time: number) => void;
  onProgress?: (seconds: number, state: StreamingPlayerState) => void;
}

export const StreamingWatchPlayer = forwardRef<SyncedStreamingWebViewHandle, Props>(
  function StreamingWatchPlayer({ platformId, onReady, onStateChange, onProgress }, ref) {
    const { colors } = useTheme();
    const platform = getStreamingPlatform(platformId);
    const playerRef = useRef<SyncedStreamingWebViewHandle>(null);

    const [authChecked, setAuthChecked] = useState(false);
    const [authenticated, setAuthenticated] = useState(false);
    const [signInOpen, setSignInOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      play: () => playerRef.current?.play(),
      pause: () => playerRef.current?.pause(),
      seekTo: (s) => playerRef.current?.seekTo(s),
      reload: () => playerRef.current?.reload(),
    }));

    useEffect(() => {
      let cancelled = false;
      void getStreamingAuthCached(platformId).then((cached) => {
        if (cancelled) return;
        if (cached) {
          setAuthenticated(true);
          setSignInOpen(false);
        } else {
          setSignInOpen(true);
        }
        setAuthChecked(true);
      });
      return () => {
        cancelled = true;
      };
    }, [platformId]);

    const handleAuthenticated = useCallback(() => {
      setAuthenticated(true);
      setSignInOpen(false);
    }, []);

    const openSignIn = () => setSignInOpen(true);

    if (!authChecked) {
      return (
        <View style={[styles.placeholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator size="large" color={platform.brandColor} />
        </View>
      );
    }

    return (
      <>
        <StreamingSignInModal
          visible={signInOpen}
          platformId={platformId}
          platformName={platform.name}
          signInUrl={platform.signInUrl}
          brandColor={platform.brandColor}
          onAuthenticated={handleAuthenticated}
          onDismiss={() => setSignInOpen(false)}
        />

        {authenticated ? (
          <SyncedStreamingWebView
            ref={playerRef}
            url={platform.watchUrl}
            platformName={platform.name}
            brandColor={platform.brandColor}
            controls
            onReady={onReady}
            onStateChange={onStateChange}
            onProgress={onProgress}
            onNeedsSignIn={(url) => {
              if (isStreamingAuthenticatedUrl(platformId, url)) return;
              void setStreamingAuthCached(platformId, false);
              setAuthenticated(false);
              setSignInOpen(true);
            }}
          />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: `${platform.brandColor}22` }]}>
              <StreamingPlatformIcon platformId={platformId} size={44} />
            </View>
            <Text style={[styles.placeholderTitle, { color: colors.text }]}>{platform.name}</Text>
            <Text style={[styles.placeholderSub, { color: colors.textSecondary }]}>
              Sign in to browse and watch with your partner
            </Text>
            <Pressable
              onPress={openSignIn}
              style={({ pressed }) => [
                styles.signInBtn,
                { backgroundColor: platform.brandColor, opacity: pressed ? 0.88 : 1 },
              ]}>
              <Text style={styles.signInBtnText}>Sign in to {platform.name}</Text>
            </Pressable>
          </View>
        )}
      </>
    );
  },
);

const styles = StyleSheet.create({
  placeholder: {
    width: '100%',
    height: 420,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  placeholderTitle: { fontSize: 20, fontWeight: '900' },
  placeholderSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  signInBtn: {
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 999,
  },
  signInBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
