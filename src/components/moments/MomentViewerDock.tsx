import { BlurView } from 'expo-blur';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LocketReactionCluster } from '@/components/moments/LocketReactionCluster';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { getMomentReactionHistory, getUserReactionEmoji } from '@/lib/moment-display';
import type { Moment } from '@/types/database';

const CLUSTER_W = Math.min(Dimensions.get('window').width - 48, 340);

interface MomentViewerDockProps {
  moment: Moment;
  isMine: boolean;
  authorName: string;
  authorAvatar?: string | null;
  partnerName: string;
  timeAgo: string;
  userId: string;
  partnerId?: string | null;
  reply: string;
  onReplyChange: (text: string) => void;
  onSendReply: () => void;
  onReact: (emoji: string) => void;
  sending?: boolean;
  bottomInset: number;
}

export function MomentViewerDock({
  moment,
  isMine,
  authorName,
  authorAvatar,
  partnerName,
  timeAgo,
  userId,
  partnerId,
  reply,
  onReplyChange,
  onSendReply,
  onReact,
  sending,
  bottomInset,
}: MomentViewerDockProps) {
  const { colors } = useTheme();
  const dateLabel = format(new Date(moment.created_at), 'EEEE · MMM d');
  const reactionHistory = getMomentReactionHistory(moment, userId, partnerId, partnerName);
  const userReaction = getUserReactionEmoji(moment, userId);
  const [pickerOpen, setPickerOpen] = useState(() => !userReaction);

  useEffect(() => {
    setPickerOpen(!getUserReactionEmoji(moment, userId));
  }, [moment.id, userId]);

  const showPicker = !userReaction || pickerOpen;

  const handleReact = (emoji: string) => {
    onReact(emoji);
    setPickerOpen(false);
  };

  const body = (
    <View style={[styles.inner, { paddingBottom: bottomInset + 10 }]}>
      <View style={styles.authorRow}>
        <Avatar name={authorName} imageUrl={authorAvatar} size={36} />
        <View style={styles.authorMeta}>
          <View style={styles.authorTop}>
            <Text style={styles.authorName}>{isMine ? 'You' : authorName}</Text>
            <View style={[styles.ownerPill, { backgroundColor: isMine ? colors.accentSoft : 'rgba(255,255,255,0.1)' }]}>
              <Text style={[styles.ownerPillText, { color: isMine ? colors.accent : 'rgba(255,255,255,0.7)' }]}>
                {isMine ? 'Your moment' : 'Their moment'}
              </Text>
            </View>
          </View>
          <Text style={styles.dateLine}>
            {dateLabel} · {timeAgo}
          </Text>
        </View>
      </View>

      <View style={styles.historyBlock}>
        <Text style={styles.historyTitle}>Reaction history</Text>
        {reactionHistory.length === 0 ? (
          <Text style={styles.historyEmpty}>No reactions yet — be the first</Text>
        ) : (
          <View style={styles.historyRow}>
            {reactionHistory.map((item, i) => {
              const chip = (
                <>
                  <Text style={styles.historyEmoji}>{item.emoji}</Text>
                  <Text style={[styles.historyWho, item.isYou && { color: colors.accent }]}>{item.label}</Text>
                </>
              );

              if (item.isYou) {
                return (
                  <Pressable
                    key={`${item.emoji}-${item.label}-${i}`}
                    onPress={() => setPickerOpen(true)}
                    style={[styles.historyChip, { borderColor: colors.accent }]}>
                    {chip}
                  </Pressable>
                );
              }

              return (
                <View
                  key={`${item.emoji}-${item.label}-${i}`}
                  style={styles.historyChip}>
                  {chip}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {showPicker && (
        <LocketReactionCluster
          moment={moment}
          width={CLUSTER_W}
          onReact={handleReact}
          variant="preview"
        />
      )}

      <View style={styles.replyRow}>
        <TextInput
          value={reply}
          onChangeText={onReplyChange}
          placeholder={isMine ? 'Note to self…' : `Whisper to ${partnerName.split(' ')[0]}…`}
          placeholderTextColor="rgba(255,255,255,0.32)"
          style={styles.replyInput}
          returnKeyType="send"
          onSubmitEditing={onSendReply}
          editable={!sending}
        />
        <Pressable
          onPress={onSendReply}
          disabled={!reply.trim() || sending}
          style={[
            styles.sendBtn,
            { backgroundColor: reply.trim() && !sending ? colors.accent : 'rgba(255,255,255,0.08)' },
          ]}>
          <Icon
            name="send"
            size={18}
            color={reply.trim() && !sending ? colors.onAccent : 'rgba(255,255,255,0.3)'}
          />
        </Pressable>
      </View>

      <Text style={styles.privacy}>Just between you two</Text>
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={50} tint="dark" style={styles.dock}>
        {body}
      </BlurView>
    );
  }

  return <View style={[styles.dock, styles.dockAndroid]}>{body}</View>;
}

const styles = StyleSheet.create({
  dock: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 6,
  },
  dockAndroid: { backgroundColor: 'rgba(16,16,20,0.96)' },
  inner: { paddingHorizontal: 18, paddingTop: 14, gap: 12 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorMeta: { flex: 1, gap: 3 },
  authorTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  authorName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  ownerPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  ownerPillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  dateLine: { color: 'rgba(255,255,255,0.42)', fontSize: 12, fontWeight: '600' },
  historyBlock: { gap: 8 },
  historyTitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  historyEmpty: { color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: '600' },
  historyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  historyEmoji: { fontSize: 16 },
  historyWho: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  replyInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacy: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
