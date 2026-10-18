import { format } from 'date-fns';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LocationMapPreview } from '@/components/moments/LocationMapPreview';
import { FullScreenLocationMapModal } from '@/components/profile/FullScreenLocationMapModal';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import type { ChatAttachment } from '@/lib/chat-attachments';
import { useUIStore } from '@/stores';

interface Props {
  attachment: ChatAttachment;
  isSelf: boolean;
}

export function ChatAttachmentCard({ attachment, isSelf }: Props) {
  const { colors } = useTheme();
  const [showMap, setShowMap] = useState(false);
  const textColor = isSelf ? colors.chatBubbleSelfText : colors.text;
  const subColor = isSelf ? `${textColor}99` : colors.textSecondary;
  const dividerColor = isSelf ? `${textColor}33` : colors.border;
  // On self bubbles, chatBubbleSelf is usually the same color as accent — tinting the
  // card off the bubble's own text color (not white, not accent) keeps it visible in every theme.
  const cardBg = isSelf ? `${textColor}1F` : colors.surfaceElevated;
  const cardBorder = isSelf ? `${textColor}2E` : colors.border;
  const badgeBg = isSelf ? `${textColor}26` : colors.accentSoft;
  const badgeIconColor = isSelf ? textColor : colors.accent;
  const actionColor = isSelf ? textColor : colors.accent;

  if (attachment.type === 'location') {
    return (
      <>
        <Pressable
          onPress={() => setShowMap(true)}
          style={({ pressed }) => [
            styles.card,
            styles.wide,
            { backgroundColor: cardBg, borderColor: cardBorder },
            pressed && styles.pressed,
          ]}>
          <View style={styles.mapWrap}>
            <LocationMapPreview
              markers={[
                {
                  latitude: attachment.latitude,
                  longitude: attachment.longitude,
                  label: attachment.label,
                  color: colors.accent,
                },
              ]}
              height={148}
              interactive={false}
              style={styles.map}
            />
            <View style={styles.expandChip}>
              <Icon name="expand" size={13} color="#fff" />
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          <View style={styles.locationMeta}>
            <View style={[styles.iconBadge, { backgroundColor: badgeBg }]}>
              <Icon name="location" size={16} color={badgeIconColor} filled />
            </View>
            <View style={styles.metaText}>
              <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
                {attachment.label}
              </Text>
              <Text style={[styles.sub, { color: actionColor }]}>Tap to view</Text>
            </View>
            <Icon name="chevronRight" size={16} color={subColor} />
          </View>
        </Pressable>

        <FullScreenLocationMapModal
          visible={showMap}
          markers={[{ latitude: attachment.latitude, longitude: attachment.longitude, label: attachment.label }]}
          title={attachment.label}
          onClose={() => setShowMap(false)}
        />
      </>
    );
  }

  if (attachment.type === 'contact') {
    const initial = attachment.name.trim().charAt(0).toUpperCase() || '?';
    return (
      <View style={[styles.card, styles.wide, styles.contactCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={styles.contactHeader}>
          <View style={[styles.avatar, { backgroundColor: badgeBg, borderColor: badgeIconColor }]}>
            <Text style={[styles.avatarText, { color: badgeIconColor }]}>{initial}</Text>
          </View>
          <View style={styles.metaText}>
            <Text style={[styles.contactKicker, { color: subColor }]}>Contact</Text>
            <Text style={[styles.contactName, { color: textColor }]} numberOfLines={1}>
              {attachment.name}
            </Text>
          </View>
        </View>

        {(attachment.phone || attachment.email) && (
          <View style={[styles.divider, { backgroundColor: dividerColor, marginTop: 12 }]} />
        )}

        {attachment.phone ? (
          <Pressable
            onPress={() => void Linking.openURL(`tel:${attachment.phone}`)}
            style={({ pressed }) => [styles.detailRow, pressed && styles.pressed]}>
            <View style={[styles.iconBadge, styles.iconBadgeSmall, { backgroundColor: badgeBg }]}>
              <Icon name="call" size={14} color={badgeIconColor} />
            </View>
            <Text style={[styles.detailText, { color: textColor }]} numberOfLines={1}>
              {attachment.phone}
            </Text>
          </Pressable>
        ) : null}

        {attachment.email ? (
          <Pressable
            onPress={() => void Linking.openURL(`mailto:${attachment.email}`)}
            style={({ pressed }) => [styles.detailRow, pressed && styles.pressed]}>
            <View style={[styles.iconBadge, styles.iconBadgeSmall, { backgroundColor: badgeBg }]}>
              <Icon name="mail" size={14} color={badgeIconColor} />
            </View>
            <Text style={[styles.detailText, { color: textColor }]} numberOfLines={1}>
              {attachment.email}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (attachment.type === 'achievement') {
    // A new trophy opens the trophy itself (the achievement card, to share); a finished
    // daily quest opens Play, where today's quests live.
    const quest = attachment.kind === 'quest';
    return (
      <Pressable
        onPress={() =>
          quest
            ? router.navigate('/(tabs)/activities')
            : useUIStore.getState().openTrophy(attachment.id ?? attachment.title)
        }
        accessibilityRole="button"
        accessibilityLabel={`${quest ? 'Quest complete' : 'Trophy unlocked'}: ${attachment.title}`}
        style={({ pressed }) => [
          styles.card,
          styles.wide,
          styles.playCard,
          { backgroundColor: cardBg, borderColor: cardBorder },
          pressed && styles.pressed,
        ]}>
        <View style={styles.playHead}>
          <View style={[styles.achieveBadge, { backgroundColor: badgeBg }]}>
            <Text style={styles.achieveEmoji}>{attachment.emoji}</Text>
          </View>
          <View style={styles.metaText}>
            <Text style={[styles.contactKicker, { color: subColor }]}>
              {quest ? 'DAILY QUEST COMPLETE' : 'TROPHY UNLOCKED'}
            </Text>
            <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
              {attachment.title}
            </Text>
            <Text style={[styles.sub, { color: subColor }]} numberOfLines={2}>
              {attachment.sub}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  if (attachment.type === 'plan') {
    // The plan quoted as a card (tap to open it in Plan), then what was said about it.
    const at = new Date(attachment.at);
    const when = Number.isNaN(at.getTime()) ? '' : format(at, "EEE d MMM 'at' h:mm a");
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/calendar', params: { plan: attachment.planId } })}
        accessibilityRole="button"
        accessibilityLabel={`Plan: ${attachment.title}${when ? `, ${when}` : ''}. Open the plan`}
        style={({ pressed }) => [
          styles.card,
          styles.wide,
          styles.playCard,
          { backgroundColor: cardBg, borderColor: cardBorder },
          pressed && styles.pressed,
        ]}>
        <View style={styles.playHead}>
          <View style={[styles.iconBadge, { backgroundColor: badgeBg }]}>
            <Icon name="calendar" size={18} color={badgeIconColor} />
          </View>
          <View style={styles.metaText}>
            <Text style={[styles.contactKicker, { color: subColor }]}>PLAN</Text>
            <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
              {attachment.title}
            </Text>
            {when ? (
              <Text style={[styles.sub, { color: subColor }]} numberOfLines={1}>
                {when}
                {attachment.location ? ` · ${attachment.location}` : ''}
              </Text>
            ) : null}
          </View>
          <Icon name="chevronRight" size={16} color={subColor} />
        </View>
        {attachment.reply ? (
          <>
            <View style={[styles.divider, { backgroundColor: dividerColor }]} />
            <Text style={[styles.playReply, { color: textColor }]}>{attachment.reply}</Text>
          </>
        ) : null}
      </Pressable>
    );
  }

  if (attachment.type === 'play_result' || attachment.type === 'play_answer') {
    const openPack = () => router.push({ pathname: '/play/pack/[id]', params: { id: attachment.packId } });

    if (attachment.type === 'play_result') {
      // "You both finished…": the pack's results, one tap from the chat.
      return (
        <Pressable
          onPress={openPack}
          accessibilityRole="button"
          accessibilityLabel={`You both finished ${attachment.title}. See your answers`}
          style={({ pressed }) => [
            styles.card,
            styles.wide,
            styles.playCard,
            { backgroundColor: cardBg, borderColor: cardBorder },
            pressed && styles.pressed,
          ]}>
          <View style={styles.playHead}>
            <View style={[styles.iconBadge, { backgroundColor: badgeBg }]}>
              <Icon name="gamepad" size={18} color={badgeIconColor} filled />
            </View>
            <View style={styles.metaText}>
              <Text style={[styles.contactKicker, { color: subColor }]}>{attachment.area.toUpperCase()} · PLAY</Text>
              <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
                {attachment.title}
              </Text>
            </View>
          </View>
          <Text style={[styles.playBody, { color: textColor }]}>
            You both answered all {attachment.count} questions 🎉
          </Text>
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          <View style={styles.playFoot}>
            <Text style={[styles.sub, styles.playAction, { color: actionColor }]}>See your answers</Text>
            <Icon name="chevronRight" size={16} color={actionColor} />
          </View>
        </Pressable>
      );
    }

    // A reply or reaction to an answer: the question and their answer quoted, then yours.
    return (
      <Pressable
        onPress={openPack}
        accessibilityRole="button"
        accessibilityLabel={`${attachment.reaction ?? 'Reply'} to ${attachment.answerBy}'s answer in ${attachment.packTitle}`}
        style={({ pressed }) => [
          styles.card,
          styles.wide,
          styles.playCard,
          { backgroundColor: cardBg, borderColor: cardBorder },
          pressed && styles.pressed,
        ]}>
        <Text style={[styles.contactKicker, { color: subColor }]} numberOfLines={1}>
          {attachment.packTitle.toUpperCase()}
        </Text>
        <Text style={[styles.playQuestion, { color: textColor }]}>{attachment.question}</Text>
        <View style={[styles.quote, { borderLeftColor: actionColor }]}>
          <Text style={[styles.quoteBy, { color: subColor }]}>{attachment.answerBy}</Text>
          <Text style={[styles.quoteText, { color: textColor }]} numberOfLines={4}>
            {attachment.answer}
          </Text>
        </View>
        {attachment.reaction ? (
          <Text style={styles.playReaction}>{attachment.reaction}</Text>
        ) : attachment.reply ? (
          <Text style={[styles.playReply, { color: textColor }]}>{attachment.reply}</Text>
        ) : null}
      </Pressable>
    );
  }

  const openFile = () => {
    void Linking.openURL(attachment.url);
  };

  return (
    <Pressable
      onPress={openFile}
      style={({ pressed }) => [
        styles.card,
        styles.rowCard,
        { backgroundColor: cardBg, borderColor: cardBorder },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.iconBadge, { backgroundColor: badgeBg }]}>
        <Icon name="document" size={20} color={badgeIconColor} />
      </View>
      <View style={styles.metaText}>
        <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
          {attachment.name}
        </Text>
        <Text style={[styles.sub, { color: subColor }]}>Tap to open</Text>
      </View>
      <Icon name="download" size={18} color={subColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.85 },
  wide: { width: 264 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  mapWrap: { position: 'relative' },
  map: { borderRadius: 0 },
  expandChip: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  divider: { height: StyleSheet.hairlineWidth },
  locationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeSmall: { width: 30, height: 30, borderRadius: 9 },
  metaText: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2, fontWeight: '700' },
  contactCard: { padding: 14 },
  contactHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contactKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginBottom: 3 },
  contactName: { fontSize: 16, fontWeight: '800' },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
  },
  detailText: { flex: 1, fontSize: 13, fontWeight: '600' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  avatarText: { fontSize: 18, fontWeight: '800' },
  playCard: { padding: 14, gap: 8 },
  achieveBadge: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  achieveEmoji: { fontSize: 28 },
  playHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playBody: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  playFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 },
  playAction: { marginTop: 0 },
  playQuestion: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  quote: { borderLeftWidth: 3, paddingLeft: 10, gap: 2 },
  quoteBy: { fontSize: 11, fontWeight: '800' },
  quoteText: { fontSize: 14, lineHeight: 19, fontStyle: 'italic' },
  playReaction: { fontSize: 34, lineHeight: 40 },
  playReply: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
});
