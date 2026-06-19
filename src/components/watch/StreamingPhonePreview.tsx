import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { StreamingPlatformIcon } from '@/components/watch/StreamingPlatformIcon';
import { getStreamingPlatform, type StreamingPlatformId } from '@/constants/streaming-platforms';
import { useTheme } from '@/hooks/useTheme';

export type StreamingPhoneMode = 'idle' | 'preview' | 'watching';

type Props = {
  platformId: StreamingPlatformId | null;
  mode?: StreamingPhoneMode;
  title?: string;
  isPlaying?: boolean;
  playbackTime?: string;
  onOpenApp?: () => void;
  size?: 'md' | 'lg';
};

const SIZES = {
  md: { w: 172, h: 340, radius: 32 },
  lg: { w: 210, h: 400, radius: 36 },
};

export function StreamingPhonePreview({
  platformId,
  mode = 'idle',
  title,
  isPlaying = false,
  playbackTime = '0:00',
  onOpenApp,
  size = 'md',
}: Props) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const platform = platformId ? getStreamingPlatform(platformId) : null;
  const dims = SIZES[size];
  const phoneW = size === 'lg' ? Math.min(dims.w, windowWidth - 80) : dims.w;
  const phoneH = phoneW * (dims.h / dims.w);
  const scale = phoneW / dims.w;

  const displayTitle = title?.trim() || platform?.name || 'Watch party';
  const active = mode === 'watching';
  const selected = mode === 'preview' || active;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.bezel,
          {
            width: phoneW,
            height: phoneH,
            borderRadius: dims.radius * scale,
            backgroundColor: colors.isDark ? '#1a1a1e' : '#2c2c30',
            borderColor: colors.isDark ? '#3a3a40' : '#1a1a1e',
          },
        ]}>
        <View style={[styles.notch, { width: 56 * scale, height: 16 * scale, borderRadius: 9 * scale, top: 8 * scale }]} />

        <View
          style={[
            styles.screen,
            {
              borderRadius: (dims.radius - 8) * scale,
              backgroundColor: colors.background,
            },
          ]}>
          {!selected || !platform ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
                <Icon name="film" size={26 * scale} color={colors.textTertiary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textSecondary, fontSize: 12 * scale }]}>
                Select a service
              </Text>
            </View>
          ) : (
            <View style={styles.screenColumn}>
              <LinearGradient
                colors={[`${platform.brandColor}40`, `${platform.brandColor}10`, colors.background]}
                style={StyleSheet.absoluteFill}
              />

              <View style={[styles.statusBar, { paddingHorizontal: 10 * scale, paddingTop: 22 * scale }]}>
                <Text style={[styles.statusTime, { color: colors.textSecondary, fontSize: 9 * scale }]}>
                  9:41
                </Text>
                {active && (
                  <View style={[styles.liveBadge, { backgroundColor: colors.error }]}>
                    <View style={styles.livePulse} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                )}
              </View>

              <View style={[styles.videoFrame, { borderColor: `${platform.brandColor}55`, flex: 1 }]}>
                <LinearGradient
                  colors={[`${platform.brandColor}90`, `${platform.brandColor}40`, '#000000dd']}
                  style={StyleSheet.absoluteFill}
                />
                {!isPlaying && (
                  <View style={styles.playOverlay}>
                    {mode === 'preview' ? (
                      <View style={styles.previewCenter}>
                        <StreamingPlatformIcon platformId={platform.id} size={40 * scale} />
                      </View>
                    ) : (
                      <View style={[styles.playCircle, { backgroundColor: platform.brandColor, width: 40 * scale, height: 40 * scale, borderRadius: 20 * scale }]}>
                        <Icon name="play" size={18 * scale} color="#fff" filled />
                      </View>
                    )}
                  </View>
                )}
                <View style={styles.videoMeta}>
                  <Text style={[styles.videoTitle, { fontSize: 10 * scale }]} numberOfLines={1}>
                    {displayTitle}
                  </Text>
                </View>
              </View>

              {active && (
                <View style={[styles.progressWrap, { paddingHorizontal: 10 * scale }]}>
                  <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { backgroundColor: platform.brandColor, width: isPlaying ? '42%' : '18%' },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressTime, { color: colors.textTertiary, fontSize: 9 * scale }]}>
                    {playbackTime}
                  </Text>
                </View>
              )}

              {active && onOpenApp && (
                <Pressable
                  onPress={onOpenApp}
                  style={({ pressed }) => [
                    styles.openBtn,
                    {
                      marginHorizontal: 10 * scale,
                      backgroundColor: platform.brandColor,
                      opacity: pressed ? 0.88 : 1,
                      paddingVertical: 8 * scale,
                    },
                  ]}>
                  <Icon name="play" size={12 * scale} color="#fff" filled />
                  <Text style={[styles.openBtnText, { fontSize: 11 * scale }]} numberOfLines={1}>
                    Open app
                  </Text>
                </Pressable>
              )}

              <View
                style={[
                  styles.momentsDock,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    marginHorizontal: 10 * scale,
                    marginBottom: 8 * scale,
                    padding: 8 * scale,
                  },
                ]}>
                <View style={[styles.momentsIcon, { backgroundColor: colors.accentSoft, width: 24 * scale, height: 24 * scale }]}>
                  <Icon name="heart" size={11 * scale} color={colors.accent} filled />
                </View>
                <View style={styles.momentsCopy}>
                  <Text style={[styles.momentsTitle, { color: colors.text, fontSize: 9 * scale }]} numberOfLines={1}>
                    Moments
                  </Text>
                  <Text style={[styles.momentsSub, { color: colors.textSecondary, fontSize: 8 * scale }]} numberOfLines={1}>
                    {active ? 'Chat here' : 'Stay connected'}
                  </Text>
                </View>
                {active && (
                  <View style={[styles.momentsLive, { backgroundColor: colors.success }]}>
                    <Text style={{ color: '#fff', fontSize: 7 * scale, fontWeight: '800' }}>ON</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        <View style={[styles.homeIndicator, { width: 40 * scale, backgroundColor: colors.textTertiary }]} />
      </View>

      {selected && platform && (
        <Text style={[styles.caption, { color: colors.textTertiary }]} numberOfLines={2}>
          {active
            ? `Watching on ${platform.name}`
            : `Plays in ${platform.name} on your phone`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  bezel: {
    borderWidth: 2,
    padding: 6,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  notch: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#0d0d0f',
    zIndex: 3,
  },
  screen: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  screenColumn: {
    flex: 1,
    gap: 6,
    zIndex: 1,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  statusTime: { fontWeight: '700' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  livePulse: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 7, fontWeight: '900', letterSpacing: 0.4 },
  videoFrame: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 0,
    justifyContent: 'flex-end',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoMeta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  videoTitle: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  progressWrap: { gap: 3, flexShrink: 0 },
  progressTrack: { height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressTime: { fontWeight: '600', textAlign: 'right' },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 10,
    flexShrink: 0,
  },
  openBtnText: { color: '#fff', fontWeight: '800' },
  momentsDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  momentsIcon: {
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  momentsCopy: { flex: 1, minWidth: 0 },
  momentsTitle: { fontWeight: '800' },
  momentsSub: { lineHeight: 11 },
  momentsLive: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontWeight: '700' },
  homeIndicator: {
    height: 3,
    borderRadius: 2,
    marginTop: 5,
    opacity: 0.3,
  },
  caption: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 8,
    lineHeight: 16,
  },
});
