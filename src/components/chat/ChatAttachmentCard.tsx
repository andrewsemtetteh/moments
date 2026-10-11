import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LocationMapPreview } from '@/components/moments/LocationMapPreview';
import { FullScreenLocationMapModal } from '@/components/profile/FullScreenLocationMapModal';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import type { ChatAttachment } from '@/lib/chat-attachments';

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
            <Text style={[styles.contactKicker, { color: subColor }]}>CONTACT</Text>
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
});
