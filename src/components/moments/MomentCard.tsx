import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { MOOD_COLORS, MOOD_EMOJI, MOOD_LABELS } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { useMomentReaction } from '@/hooks/queries';
import { useAuthStore } from '@/stores';
import type { Moment, MomentType } from '@/types/database';

const TYPE_ICON: Record<MomentType, IconName> = {
  photo: 'camera',
  text: 'chat',
  voice: 'mic',
  mood: 'heart',
  location: 'location',
};

interface MomentCardProps {
  moment: Moment;
  onPress?: () => void;
}

export function MomentCard({ moment, onPress }: MomentCardProps) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const reactMutation = useMomentReaction();

  const reactions = Object.entries(moment.reactions ?? {}).filter(([, u]) => u.length > 0);
  const iLiked = (moment.reactions?.['❤️'] ?? []).includes(user?.id ?? '');

  const like = () => {
    if (moment.id.startsWith('temp-')) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reactMutation.mutate({ momentId: moment.id, emoji: '❤️' });
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
      <View style={styles.header}>
        <Avatar name={moment.author?.name} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.author, { color: colors.text }]}>{moment.author?.name ?? 'Partner'}</Text>
          <Text style={[styles.time, { color: colors.textTertiary }]}>
            {formatDistanceToNow(new Date(moment.created_at), { addSuffix: true })}
          </Text>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: colors.accentSoft }]}>
          <Icon name={TYPE_ICON[moment.type] ?? 'heart'} size={14} color={colors.accent} />
        </View>
      </View>

      {moment.type === 'photo' && moment.media_url && (
        <Image source={{ uri: moment.media_url }} style={styles.image} contentFit="cover" />
      )}

      {moment.type === 'mood' && moment.mood && (
        <View style={[styles.moodChip, { backgroundColor: (MOOD_COLORS[moment.mood] ?? colors.accent) + '22' }]}>
          <Text style={styles.moodEmoji}>{MOOD_EMOJI[moment.mood]}</Text>
          <Text style={[styles.moodText, { color: colors.text }]}>Feeling {MOOD_LABELS[moment.mood] ?? moment.mood}</Text>
        </View>
      )}

      {moment.content && <Text style={[styles.content, { color: colors.text }]}>{moment.content}</Text>}

      <View style={styles.footer}>
        <View style={styles.reactionsRow}>
          {reactions.map(([emoji, u]) => (
            <View key={emoji} style={[styles.reactionPill, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={{ fontSize: 12 }}>{emoji}{u.length > 1 ? ` ${u.length}` : ''}</Text>
            </View>
          ))}
        </View>
        <Pressable onPress={like} hitSlop={8} style={styles.likeBtn}>
          <Icon name="heart" size={20} color={iLiked ? colors.accent : colors.textSecondary} filled={iLiked} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  author: { fontSize: 14, fontWeight: '700' },
  time: { fontSize: 12, marginTop: 1 },
  typeBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: 220, borderRadius: 14, marginBottom: 10 },
  moodChip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginBottom: 8 },
  moodEmoji: { fontSize: 22 },
  moodText: { fontSize: 14, fontWeight: '600' },
  content: { fontSize: 15, lineHeight: 22 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  reactionsRow: { flexDirection: 'row', gap: 6, flex: 1 },
  reactionPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  likeBtn: { padding: 2 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
});
