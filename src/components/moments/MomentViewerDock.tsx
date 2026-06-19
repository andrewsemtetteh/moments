import { format } from 'date-fns';
import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LocketReactionCluster } from '@/components/moments/LocketReactionCluster';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { getMomentReactionHistory, getUserReactionEmoji } from '@/lib/moment-display';
import { momentChrome } from '@/lib/moment-theme';
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
  const chrome = momentChrome(colors);
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
            <Text style={[styles.authorName, { color: chrome.text }]}>{isMine ? 'You' : authorName}</Text>
            <View style={[styles.ownerPill, { backgroundColor: isMine ? colors.accentSoft : chrome.surfaceSoft }]}>
              <Text style={[styles.ownerPillText, { color: isMine ? colors.accent : chrome.textSecondary }]}>
                {isMine ? 'Your moment' : 'Their moment'}
              </Text>
            </View>
          </View>
          <Text style={[styles.dateLine, { color: chrome.textSecondary }]}>
            {dateLabel} · {timeAgo}
          </Text>
        </View>
      </View>

      <View style={styles.historyBlock}>
        <Text style={[styles.historyTitle, { color: chrome.textTertiary }]}>Reaction history</Text>
        {reactionHistory.length === 0 ? (
          <Text style={[styles.historyEmpty, { color: chrome.textTertiary }]}>No reactions yet. Be the first!</Text>
        ) : (
          <View style={styles.historyRow}>
            {reactionHistory.map((item, i) => {
              const chip = (
                <>
                  <Text style={styles.historyEmoji}>{item.emoji}</Text>
                  <Text style={[styles.historyWho, { color: chrome.textSecondary }, item.isYou && { color: colors.accent }]}>{item.label}</Text>
                </>
              );

              if (item.isYou) {
                return (
                  <Pressable
                    key={`${item.emoji}-${item.label}-${i}`}
                    onPress={() => setPickerOpen(true)}
                    style={[styles.historyChip, { backgroundColor: chrome.surfaceSoft, borderColor: colors.accent }]}>
                    {chip}
                  </Pressable>
                );
              }

              return (
                <View
                  key={`${item.emoji}-${item.label}-${i}`}
                  style={[styles.historyChip, { backgroundColor: chrome.surfaceSoft, borderColor: chrome.border }]}>
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
          placeholderTextColor={chrome.textTertiary}
          style={[styles.replyInput, { backgroundColor: chrome.surfaceSoft, color: chrome.text, borderColor: chrome.border }]}
          returnKeyType="send"
          onSubmitEditing={onSendReply}
          editable={!sending}
        />
        <Pressable
          onPress={onSendReply}
          disabled={!reply.trim() || sending}
          style={[
            styles.sendBtn,
            { backgroundColor: reply.trim() && !sending ? colors.accent : chrome.surfaceSoft },
          ]}>
          <Icon
            name="send"
            size={18}
            color={reply.trim() && !sending ? colors.onAccent : chrome.textTertiary}
          />
        </Pressable>
      </View>

      <Text style={[styles.privacy, { color: chrome.textTertiary }]}>Just between you two</Text>
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={50} tint={colors.isDark ? 'dark' : 'light'} style={[styles.dock, { borderColor: chrome.border }]}>
        {body}
      </BlurView>
    );
  }

  return <View style={[styles.dock, styles.dockAndroid, { backgroundColor: chrome.elevated, borderColor: chrome.border }]}>{body}</View>;
}

const styles = StyleSheet.create({
  dock: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    zIndex: 6,
  },
  dockAndroid: {},
  inner: { paddingHorizontal: 18, paddingTop: 14, gap: 12 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorMeta: { flex: 1, gap: 3 },
  authorTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  authorName: { fontSize: 16, fontWeight: '800' },
  ownerPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  ownerPillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  dateLine: { fontSize: 12, fontWeight: '600' },
  historyBlock: { gap: 8 },
  historyTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  historyEmpty: { fontSize: 13, fontWeight: '600' },
  historyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  historyEmoji: { fontSize: 16 },
  historyWho: { fontSize: 12, fontWeight: '700' },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  privacy: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
