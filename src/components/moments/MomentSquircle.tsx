import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { MOOD_COLORS, MOOD_EMOJI } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { useVideoThumbnail } from '@/hooks/useVideoThumbnail';
import { momentChrome } from '@/lib/moment-theme';
import type { Moment } from '@/types/database';

interface MomentSquircleProps {
  moment: Moment;
  size: number;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Counter-party reaction — notification badge top-right */
  reactionBadge?: { emoji: string; count: number } | null;
  selecting?: boolean;
  selected?: boolean;
  /** Show a small avatar chip for who sent it — off by default for single-media grids. */
  showAuthor?: boolean;
  isMine?: boolean;
}

/** Stable, non-random tint so the same moment always placeholders the same color while its image loads. */
function placeholderTint(seed: string, palette: readonly string[]): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

const PLACEHOLDER_PALETTE = ['#F0A8C0', '#A8C0F0', '#F0C89A', '#B8E0C8', '#D0B8F0', '#F0D08A'] as const;

export function MomentSquircle({
  moment,
  size,
  onPress,
  onLongPress,
  reactionBadge,
  selecting = false,
  selected = false,
  showAuthor = true,
  isMine,
}: MomentSquircleProps) {
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  const radius = size * 0.26;
  const [loaded, setLoaded] = useState(false);

  const tint = useMemo(() => placeholderTint(moment.id, PLACEHOLDER_PALETTE), [moment.id]);
  const mine = isMine ?? false;
  const authorAvatar = moment.author?.avatar_url;
  const authorName = moment.author?.name;

  const hasMedia = !!moment.media_url && (moment.type === 'photo' || moment.type === 'video');
  const videoThumb = useVideoThumbnail(moment.type === 'video' ? moment.media_url : null);

  const content = (
    <View style={[styles.outer, { width: size, height: size }]}>
      <View
        style={[
          styles.wrap,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: hasMedia ? tint + (loaded ? '00' : '55') : chrome.surface,
          },
          styles.shadow,
          { shadowColor: colors.isDark ? '#000' : '#0B0B14' },
          selecting && selected && { borderWidth: 2.5, borderColor: chrome.accent },
        ]}>
        {moment.type === 'video' && moment.media_url ? (
          <>
            {videoThumb ? (
              <Image source={videoThumb} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            ) : null}
            <View style={[styles.playPill, { backgroundColor: 'rgba(0,0,0,0.42)' }]}>
              <Icon name="play" size={10} color="#fff" filled />
            </View>
          </>
        ) : moment.media_url ? (
          <Image
            source={{ uri: moment.media_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={220}
            onLoad={() => setLoaded(true)}
          />
        ) : (
          <MomentTypeFallback moment={moment} size={size} chrome={chrome} />
        )}

        <View style={[styles.sheen, { borderRadius: radius }]} pointerEvents="none" />

        {selecting && (
          <View style={[styles.selectOverlay, selected && styles.selectOverlayActive]}>
            <View
              style={[
                styles.selectCircle,
                { borderColor: '#fff' },
                selected && { backgroundColor: chrome.accent, borderColor: chrome.accent },
              ]}>
              {selected && <Icon name="check" size={14} color={chrome.onAccent} />}
            </View>
          </View>
        )}
      </View>

      {showAuthor && !selecting && (authorAvatar || authorName) && (
        <View
          style={[
            styles.authorChip,
            { borderColor: chrome.background, backgroundColor: mine ? '#e85d75' : '#5b8def' },
          ]}>
          <Avatar name={authorName} imageUrl={authorAvatar} size={18} colorsOverride={['#ffffff', '#ffffff']} />
        </View>
      )}

      {reactionBadge && !selecting && (
        <View style={[styles.reactionBadge, { backgroundColor: chrome.surface, borderColor: chrome.background }]}>
          <Text style={styles.reactionEmoji}>{reactionBadge.emoji}</Text>
          {reactionBadge.count > 1 && (
            <View style={[styles.reactionCount, { backgroundColor: chrome.error, borderColor: chrome.background }]}>
              <Text style={[styles.reactionCountText, { color: chrome.onAccent }]}>{reactionBadge.count}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={320}
        style={({ pressed }) => [
          { width: size, height: size },
          pressed && { opacity: 0.94, transform: [{ scale: 0.97 }] },
        ]}>
        {content}
      </Pressable>
    );
  }

  return content;
}

/** Type-aware placeholder for non-photo/video moments — mood tint, voice waveform, or a text glyph. */
function MomentTypeFallback({
  moment,
  size,
  chrome,
}: {
  moment: Moment;
  size: number;
  chrome: ReturnType<typeof momentChrome>;
}) {
  if (moment.type === 'mood' && moment.mood) {
    const tint = MOOD_COLORS[moment.mood] ?? chrome.accent;
    return (
      <View style={[StyleSheet.absoluteFill, styles.fallback, { backgroundColor: tint + '2A' }]}>
        <Text style={{ fontSize: size * 0.4 }}>{MOOD_EMOJI[moment.mood] ?? '💭'}</Text>
      </View>
    );
  }

  if (moment.type === 'voice') {
    return (
      <View style={[StyleSheet.absoluteFill, styles.fallback, { backgroundColor: chrome.accentSoft }]}>
        <Icon name="mic" size={size * 0.26} color={chrome.accent} filled />
      </View>
    );
  }

  if (moment.type === 'location') {
    return (
      <View style={[StyleSheet.absoluteFill, styles.fallback, { backgroundColor: chrome.accentSoft }]}>
        <Icon name="location" size={size * 0.26} color={chrome.accent} filled />
      </View>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.fallback, { backgroundColor: chrome.surface }]}>
      <Icon name="heart" size={size * 0.28} color={chrome.textTertiary} filled />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: 'relative', overflow: 'visible' },
  wrap: { overflow: 'hidden', position: 'relative' },
  shadow: {
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 4,
  },
  sheen: {
    ...StyleSheet.absoluteFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  playPill: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorChip: {
    position: 'absolute',
    bottom: -4,
    left: -4,
    borderRadius: 12,
    borderWidth: 2,
    padding: 1,
  },
  selectOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 6,
  },
  selectOverlayActive: { backgroundColor: 'rgba(0,0,0,0.1)' },
  selectCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
    zIndex: 10,
  },
  reactionEmoji: { fontSize: 17 },
  reactionCount: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
  },
  reactionCountText: { fontSize: 9, fontWeight: '800' },
});
