import { format } from 'date-fns';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { MOOD_COLORS, MOOD_EMOJI } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { useVideoThumbnail } from '@/hooks/useVideoThumbnail';
import { momentChrome } from '@/lib/moment-theme';
import type { Moment } from '@/types/database';

const PLACEHOLDER = ['#F0A8C0', '#A8C0F0', '#F0C89A', '#B8E0C8', '#D0B8F0', '#F0D08A'] as const;

function tintFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PLACEHOLDER[hash % PLACEHOLDER.length];
}

/**
 * A moment in the History grid: a portrait card (photos are taken upright),
 * the picture or a still from the video, and a soft strip along the bottom
 * with who sent it and when. Badges sit inside the corners, never hanging off.
 */
export function MomentTile({
  moment,
  width,
  height,
  onPress,
  onLongPress,
  reactionBadge,
  selecting = false,
  selected = false,
}: {
  moment: Moment;
  width: number;
  height: number;
  onPress?: () => void;
  onLongPress?: () => void;
  reactionBadge?: { emoji: string; count: number } | null;
  selecting?: boolean;
  selected?: boolean;
}) {
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  const [loaded, setLoaded] = useState(false);
  const tint = useMemo(() => tintFor(moment.id), [moment.id]);
  const isVideo = moment.type === 'video' && !!moment.media_url;
  const thumb = useVideoThumbnail(isVideo ? moment.media_url : null);
  const source = isVideo ? thumb : moment.media_url ? { uri: moment.media_url } : null;
  const when = format(new Date(moment.created_at), 'h:mm a');

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={320}
      accessibilityRole="imagebutton"
      accessibilityLabel={`${isVideo ? 'Video' : 'Photo'} from ${moment.author?.name ?? 'you'}, ${when}`}
      accessibilityState={selecting ? { selected } : undefined}
      style={({ pressed }) => [{ width, height }, pressed && styles.pressed]}>
      <View
        style={[
          styles.card,
          { width, height, backgroundColor: loaded ? chrome.surfaceSoft : tint + '55' },
          selecting && selected && { borderWidth: 3, borderColor: chrome.accent },
        ]}>
        {source ? (
          <Image
            source={source}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            recyclingKey={moment.id}
            onLoad={() => setLoaded(true)}
          />
        ) : (
          <Fallback moment={moment} chrome={chrome} size={Math.min(width, height)} />
        )}

        {/* Who and when, on a soft fade so it reads on any photo. */}
        {!selecting ? (
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={styles.strip} pointerEvents="none">
            <View style={styles.author}>
              <Avatar
                name={moment.author?.name}
                imageUrl={moment.author?.avatar_url}
                size={18}
                colorsOverride={['#ffffff', '#ffffff']}
              />
            </View>
            <Text style={styles.time} numberOfLines={1}>
              {when}
            </Text>
          </LinearGradient>
        ) : null}

        {isVideo ? (
          <View style={styles.play}>
            <Icon name="play" size={10} color="#fff" filled />
          </View>
        ) : null}

        {reactionBadge && !selecting ? (
          <View style={styles.reaction}>
            <Text style={styles.reactionEmoji}>{reactionBadge.emoji}</Text>
            {reactionBadge.count > 1 ? <Text style={styles.reactionCount}>{reactionBadge.count}</Text> : null}
          </View>
        ) : null}

        {selecting ? (
          <View style={[styles.selectShade, selected && styles.selectShadeOn]}>
            <View style={[styles.check, selected && { backgroundColor: chrome.accent, borderColor: chrome.accent }]}>
              {selected ? <Icon name="check" size={14} color={chrome.onAccent} /> : null}
            </View>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function Fallback({ moment, chrome, size }: { moment: Moment; chrome: ReturnType<typeof momentChrome>; size: number }) {
  if (moment.type === 'mood' && moment.mood) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: (MOOD_COLORS[moment.mood] ?? chrome.accent) + '2A' }]}>
        <Text style={{ fontSize: size * 0.36 }}>{MOOD_EMOJI[moment.mood] ?? '💭'}</Text>
      </View>
    );
  }
  const icon = moment.type === 'voice' ? 'mic' : moment.type === 'location' ? 'location' : 'heart';
  return (
    <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: chrome.accentSoft }]}>
      <Icon name={icon} size={size * 0.24} color={chrome.accent} filled />
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.92, transform: [{ scale: 0.97 }] },
  card: { borderRadius: 16, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  strip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 44,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingHorizontal: 7,
    paddingBottom: 7,
  },
  author: { borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)' },
  time: { flexShrink: 1, color: '#FFFFFF', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  play: {
    position: 'absolute',
    top: 7,
    left: 7,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reaction: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 26,
    minWidth: 26,
    paddingHorizontal: 5,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11, fontWeight: '800', color: '#1A1A1A' },
  selectShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'flex-end',
    padding: 7,
  },
  selectShadeOn: { backgroundColor: 'rgba(0,0,0,0.06)' },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
