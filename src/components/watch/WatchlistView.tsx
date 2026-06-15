import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { StreamingPlatformIcon } from '@/components/watch/StreamingPlatformIcon';
import { WatchScreen } from '@/components/watch/WatchScreen';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/primitives';
import { STREAMING_PLATFORMS, getStreamingPlatform } from '@/constants/streaming-platforms';
import { WATCH_VOTE_OPTIONS } from '@/constants/watch-together';
import { useWatchlist, useWatchlistMutations } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { WatchlistItem, WatchVote } from '@/types/database';

const QUICK_PLATFORMS = STREAMING_PLATFORMS.slice(0, 6);

export function WatchlistView({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);

  const { data: items = [] } = useWatchlist();
  const { add, vote, setWatched, remove } = useWatchlistMutations();

  const [title, setTitle] = useState('');
  const [platformId, setPlatformId] = useState<string | null>(null);

  const { pending, watched } = useMemo(() => {
    return {
      pending: items.filter((i) => !i.watched),
      watched: items.filter((i) => i.watched),
    };
  }, [items]);

  const handleAdd = () => {
    const t = title.trim();
    if (!t) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    add.mutate(
      { title: t, platformId: platformId ?? undefined },
      {
        onSuccess: () => {
          setTitle('');
          setPlatformId(null);
        },
        onError: () => Alert.alert('Could not add', 'Please try again.'),
      },
    );
  };

  const nameFor = (id: string) =>
    id === user?.id ? 'You' : getFirstName(partner?.name) ?? 'Partner';

  return (
    <WatchScreen title="Watchlist" onClose={onClose} onBack={onBack}>
      <Card style={styles.composer}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Add a movie or show…"
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { color: colors.text }]}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />
        <View style={styles.platformPicker}>
          {QUICK_PLATFORMS.map((p) => {
            const active = platformId === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPlatformId(active ? null : p.id)}
                style={[styles.platformPick, active && { borderColor: colors.accent, borderWidth: 2 }]}>
                <StreamingPlatformIcon platformId={p.id} size={28} />
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={handleAdd}
          disabled={!title.trim() || add.isPending}
          style={[styles.addBtn, { backgroundColor: colors.accent, opacity: title.trim() ? 1 : 0.45 }]}>
          <Icon name="plus" size={18} color={colors.onAccent} />
          <Text style={{ color: colors.onAccent, fontWeight: '800' }}>Add to watchlist</Text>
        </Pressable>
      </Card>

      {items.length === 0 && (
        <View style={styles.empty}>
          <Text style={{ fontSize: 36 }}>🎬</Text>
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
            Build a list of things to watch together. Vote on what to see next.
          </Text>
        </View>
      )}

      {pending.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>UP NEXT</Text>
          {pending.map((item) => (
            <WatchlistRow
              key={item.id}
              item={item}
              userId={user?.id}
              nameFor={nameFor}
              colors={colors}
              onVote={(v) => vote.mutate({ item, vote: v })}
              onWatched={() => setWatched.mutate({ itemId: item.id, watched: true })}
              onRemove={() =>
                Alert.alert('Remove?', `Remove "${item.title}" from your watchlist?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(item.id) },
                ])
              }
            />
          ))}
        </View>
      )}

      {watched.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>WATCHED</Text>
          {watched.map((item) => (
            <Card key={item.id} style={[styles.row, { opacity: 0.7 }]}>
              <StreamingPlatformIcon platformId={item.platform_id ?? 'other'} size={30} />
              <Text style={[styles.rowTitle, { color: colors.text, flex: 1, textDecorationLine: 'line-through' }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Pressable onPress={() => setWatched.mutate({ itemId: item.id, watched: false })} hitSlop={8}>
                <Icon name="checkDone" size={20} color={colors.success} />
              </Pressable>
              <Pressable onPress={() => remove.mutate(item.id)} hitSlop={8}>
                <Icon name="trash" size={18} color={colors.textTertiary} />
              </Pressable>
            </Card>
          ))}
        </View>
      )}
    </WatchScreen>
  );
}

function WatchlistRow({
  item,
  userId,
  nameFor,
  colors,
  onVote,
  onWatched,
  onRemove,
}: {
  item: WatchlistItem;
  userId?: string;
  nameFor: (id: string) => string;
  colors: ReturnType<typeof useTheme>['colors'];
  onVote: (v: WatchVote) => void;
  onWatched: () => void;
  onRemove: () => void;
}) {
  const votes = item.votes ?? {};
  const myVote = userId ? votes[userId] : undefined;
  const voteEntries = Object.entries(votes);

  return (
    <Card style={styles.itemCard}>
      <View style={styles.row}>
        <StreamingPlatformIcon platformId={item.platform_id ?? 'other'} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
            {item.platform_id ? `${getStreamingPlatform(item.platform_id).name} · ` : ''}
            Added by {nameFor(item.added_by)}
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Icon name="trash" size={18} color={colors.textTertiary} />
        </Pressable>
      </View>

      <View style={styles.voteRow}>
        {WATCH_VOTE_OPTIONS.map((opt) => {
          const active = myVote === opt.value;
          const count = voteEntries.filter(([, v]) => v === opt.value).length;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                Haptics.selectionAsync();
                onVote(opt.value);
              }}
              style={[
                styles.voteChip,
                {
                  backgroundColor: active ? colors.accentSoft : colors.surfaceElevated,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}>
              <Text style={{ fontSize: 14 }}>{opt.emoji}</Text>
              <Text style={{ color: active ? colors.accent : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                {opt.label}
                {count > 0 ? ` ${count}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={onWatched} style={[styles.watchedBtn, { borderColor: colors.border }]}>
        <Icon name="check" size={16} color={colors.success} />
        <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 13 }}>Mark watched</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  composer: { gap: 12 },
  input: { fontSize: 16, paddingVertical: 4 },
  platformPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  platformPick: { borderRadius: 12, borderColor: 'transparent', borderWidth: 2, padding: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  itemCard: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  voteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  voteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  watchedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
