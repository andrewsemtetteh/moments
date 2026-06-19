import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { StreamingServiceGrid } from '@/components/watch/StreamingServiceGrid';
import { StreamingPlatformIcon } from '@/components/watch/StreamingPlatformIcon';
import { WatchPageHero, watchPanelStyles } from '@/components/watch/WatchPageHero';
import { WatchScreen } from '@/components/watch/WatchScreen';
import { getStreamingPlatform, type StreamingPlatformId } from '@/constants/streaming-platforms';
import { WATCH_VOTE_OPTIONS } from '@/constants/watch-together';
import { useWatchlist, useWatchlistMutations } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { WatchlistItem, WatchVote } from '@/types/database';

export function WatchlistView({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const partnerName = getFirstName(partner?.name) ?? 'Partner';

  const { data: items = [] } = useWatchlist();
  const { add, vote, setWatched, remove } = useWatchlistMutations();

  const [title, setTitle] = useState('');
  const [platformId, setPlatformId] = useState<StreamingPlatformId | null>(null);

  const { pending, watched } = useMemo(
    () => ({
      pending: items.filter((i) => !i.watched),
      watched: items.filter((i) => i.watched),
    }),
    [items],
  );

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
    id === user?.id ? 'You' : partnerName;

  return (
    <WatchScreen title="Watchlist" onClose={onClose} onBack={onBack}>
      <WatchPageHero
        eyebrow="PLAN AHEAD"
        title="Watchlist"
        subtitle={`Save picks you both want to see. Vote on what to watch next with ${partnerName}.`}
        icon="list"
      />

      <View
        style={[
          watchPanelStyles.panel,
          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        ]}>
        <Text style={[watchPanelStyles.sectionLabel, { color: colors.textSecondary }]}>Add to list</Text>

        <View style={[styles.composerInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="film" size={18} color={colors.textTertiary} />
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Movie or show title"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { color: colors.text }]}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
        </View>

        <StreamingServiceGrid
          selectedId={platformId}
          onSelect={(id) => setPlatformId(platformId === id ? null : id)}
          iconSize={26}
          showLabels={false}
        />

        <Pressable
          onPress={handleAdd}
          disabled={!title.trim() || add.isPending}
          style={({ pressed }) => [
            styles.addBtn,
            {
              backgroundColor: colors.accent,
              opacity: !title.trim() ? 0.45 : pressed ? 0.92 : 1,
            },
          ]}>
          <Icon name="plus" size={18} color={colors.onAccent} />
          <Text style={{ color: colors.onAccent, fontWeight: '800', fontSize: 15 }}>Add to watchlist</Text>
        </Pressable>
      </View>

      {items.length === 0 && (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
            <Icon name="film" size={28} color={colors.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing saved yet</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Add movies and shows above. You and {partnerName} can vote on what to watch first.
          </Text>
        </View>
      )}

      {pending.length > 0 && (
        <View style={styles.section}>
          <Text style={[watchPanelStyles.sectionLabel, { color: colors.textSecondary }]}>
            Up next · {pending.length}
          </Text>
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
          <Text style={[watchPanelStyles.sectionLabel, { color: colors.textSecondary }]}>
            Watched · {watched.length}
          </Text>
          {watched.map((item) => (
            <View
              key={item.id}
              style={[styles.watchedRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <StreamingPlatformIcon platformId={item.platform_id ?? 'other'} size={28} />
              <Text
                style={[styles.watchedTitle, { color: colors.textSecondary, flex: 1 }]}
                numberOfLines={1}>
                {item.title}
              </Text>
              <Pressable
                onPress={() => setWatched.mutate({ itemId: item.id, watched: false })}
                hitSlop={8}
                style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}>
                <Icon name="checkDone" size={18} color={colors.success} />
              </Pressable>
              <Pressable
                onPress={() => remove.mutate(item.id)}
                hitSlop={8}
                style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}>
                <Icon name="trash" size={16} color={colors.textTertiary} />
              </Pressable>
            </View>
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
  const mustCount = voteEntries.filter(([, v]) => v === 'must').length;

  return (
    <View style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.itemHeader}>
        <StreamingPlatformIcon platformId={item.platform_id ?? 'other'} size={36} />
        <View style={styles.itemCopy}>
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
            {item.platform_id ? `${getStreamingPlatform(item.platform_id).name} · ` : ''}
            Added by {nameFor(item.added_by)}
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={8} style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}>
          <Icon name="trash" size={16} color={colors.textTertiary} />
        </Pressable>
      </View>

      {mustCount > 0 && (
        <View style={[styles.mustBadge, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ fontSize: 13 }}>🍿</Text>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>
            {mustCount} must-watch {mustCount === 1 ? 'vote' : 'votes'}
          </Text>
        </View>
      )}

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
              <Text style={{ color: active ? colors.accent : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                {opt.label}
                {count > 0 ? ` · ${count}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={onWatched}
        style={[styles.watchedBtn, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
        <Icon name="check" size={15} color={colors.success} />
        <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 13 }}>Mark watched</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  composerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptySub: { fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 280 },
  section: { gap: 10, marginTop: 4 },
  itemCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  itemCopy: { flex: 1, gap: 3 },
  itemTitle: { fontSize: 16, fontWeight: '800', lineHeight: 21 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  voteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  voteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  watchedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  watchedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  watchedTitle: { fontSize: 14, fontWeight: '600', textDecorationLine: 'line-through' },
});
