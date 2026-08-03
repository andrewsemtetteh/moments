import { format, formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { LocketReactionCluster } from '@/components/moments/LocketReactionCluster';
import { SwipeableMomentMediaStack } from '@/components/moments/SwipeableMomentMediaStack';
import { Icon } from '@/components/ui/Icon';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { Avatar } from '@/components/ui/primitives';
import { Radius } from '@/constants/design-system';
import { useMomentReaction, useSendMessage } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getUserReactionEmoji, toggleMomentReactionForUser } from '@/lib/moment-display';
import { momentToReplyContext } from '@/lib/moment-reply';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import type { Moment } from '@/types/database';

const BLOB_W = Math.min(Dimensions.get('window').width - 48, 340);

interface PartnerMomentHomeProps {
  partnerMoments: Moment[];
}

export function PartnerMomentHome({ partnerMoments }: PartnerMomentHomeProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const openMomentViewer = useUIStore((s) => s.openMomentViewer);
  const setShowMomentHistory = useUIStore((s) => s.setShowMomentHistory);
  const setChatDraft = useUIStore((s) => s.setChatDraft);
  const setChatMomentReply = useUIStore((s) => s.setChatMomentReply);

  const [activeIndex, setActiveIndex] = useState(0);
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [localReactions, setLocalReactions] = useState<Record<string, Record<string, string[]>>>({});

  const reactMutation = useMomentReaction();
  const sendMessageMutation = useSendMessage();

  const stackKey = partnerMoments.map((m) => m.id).join('|');

  useEffect(() => {
    setActiveIndex(0);
    setReply('');
    setReactionPickerOpen(false);
  }, [stackKey]);

  const safeIndex =
    partnerMoments.length === 0 ? 0 : Math.min(activeIndex, partnerMoments.length - 1);
  const baseMoment = partnerMoments[safeIndex];

  const moment = useMemo(() => {
    if (!baseMoment) return null;
    const patch = localReactions[baseMoment.id];
    if (!patch) return baseMoment;
    return { ...baseMoment, reactions: patch };
  }, [baseMoment, localReactions]);

  const react = useCallback(
    (emoji: string) => {
      if (!user || !baseMoment) return;
      setLocalReactions((prev) => {
        const current = prev[baseMoment.id] ?? baseMoment.reactions ?? {};
        const next = toggleMomentReactionForUser(current, user.id, emoji);
        return { ...prev, [baseMoment.id]: next };
      });
      reactMutation.mutate({ momentId: baseMoment.id, emoji });
    },
    [baseMoment, user, reactMutation],
  );

  useEffect(() => {
    setReactionPickerOpen(false);
  }, [baseMoment?.id]);

  if (!baseMoment || !moment) return null;

  const userReaction = user ? getUserReactionEmoji(moment, user.id) : null;
  const showReactionBadge = !!userReaction && !reactionPickerOpen;
  const showReactionPicker = reactionPickerOpen || !userReaction;

  const isMine = !!user && moment.user_id === user.id;
  const authorName = isMine ? (user?.name ?? 'You') : (moment.author?.name ?? partner?.name ?? 'Partner');
  const authorAvatar = isMine ? user?.avatar_url : (moment.author?.avatar_url ?? partner?.avatar_url);
  const partnerName = partner?.name ?? 'Partner';
  const timeLabel = formatDistanceToNow(new Date(moment.created_at), { addSuffix: false })
    .replace('about ', '')
    .replace('less than a minute', 'now');
  const dateLabel = format(new Date(moment.created_at), 'EEE · MMM d');

  const openFullscreen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openMomentViewer(partnerMoments, activeIndex);
  };

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || sendingReply) return;
    setSendingReply(true);
    const previewType = moment.type === 'video' ? 'video' : 'image';
    try {
      await sendMessageMutation.mutateAsync({
        content: text,
        momentId: moment.id,
        mediaUrl: moment.media_url ?? undefined,
        mediaType: previewType,
      });
      setReply('');
      router.push('/(tabs)/chat');
    } catch {
      setChatDraft(text);
      setChatMomentReply(momentToReplyContext(moment));
      router.push('/(tabs)/chat');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <GlassSurface style={styles.card} borderRadius={Radius.lg}>
        <View style={styles.topBar}>
          <View style={styles.authorBlock}>
            <Avatar name={authorName} imageUrl={authorAvatar} size={32} />
            <View style={styles.authorMeta}>
              <Text style={[styles.authorName, { color: colors.text }]}>{isMine ? 'You' : authorName}</Text>
              <Text style={[styles.authorDetail, { color: colors.textSecondary }]}>
                {dateLabel} · {timeLabel}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => setShowMomentHistory(true)}
            hitSlop={8}
            style={styles.historyBtn}
            accessibilityLabel="Moment history">
            <Icon name="image" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.mediaSection} pointerEvents="box-none">
          <SwipeableMomentMediaStack
            moments={partnerMoments}
            width={BLOB_W}
            activeIndex={activeIndex}
            onIndexChange={setActiveIndex}
            onPress={openFullscreen}
            reactionEmoji={showReactionBadge ? userReaction : null}
            onReactionBadgePress={() => setReactionPickerOpen(true)}
          />
        </View>

        {showReactionPicker && (
          <View style={[styles.reactionsRow, { zIndex: 2 }]}>
            <LocketReactionCluster
              moment={moment}
              width={BLOB_W}
              onReact={react}
              variant="home"
              onPicked={() => setReactionPickerOpen(false)}
            />
          </View>
        )}

        <View style={styles.replyRow}>
          <TextInput
            value={reply}
            onChangeText={setReply}
            placeholder={isMine ? 'Note to self…' : `Whisper to ${partnerName.split(' ')[0]}…`}
            placeholderTextColor={colors.textTertiary}
            style={[
              styles.replyInput,
              {
                backgroundColor: colors.surfaceElevated,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            returnKeyType="send"
            onSubmitEditing={() => void sendReply()}
            editable={!sendingReply}
          />
          <Pressable
            onPress={() => void sendReply()}
            disabled={!reply.trim() || sendingReply}
            style={[
              styles.sendBtn,
              {
                backgroundColor:
                  reply.trim() && !sendingReply ? colors.accent : colors.surfaceGlass,
              },
            ]}>
            <Icon
              name="send"
              size={18}
              color={reply.trim() && !sendingReply ? colors.onAccent : colors.textTertiary}
            />
          </Pressable>
        </View>
      </GlassSurface>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingBottom: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 12,
  },
  authorBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  authorMeta: { flex: 1, gap: 2, minWidth: 0 },
  authorName: { fontWeight: '800', fontSize: 15 },
  authorDetail: { fontSize: 12, fontWeight: '600' },
  historyBtn: { padding: 4 },
  mediaSection: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 2,
  },
  reactionsRow: {
    alignItems: 'center',
    alignSelf: 'center',
    width: BLOB_W,
    marginTop: 8,
    marginBottom: 14,
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  replyInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
    borderWidth: 1,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
