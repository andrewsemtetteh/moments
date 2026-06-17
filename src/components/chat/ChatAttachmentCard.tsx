import * as Linking from 'expo-linking';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LocationMapPreview } from '@/components/moments/LocationMapPreview';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { openInMaps } from '@/lib/location';
import type { ChatAttachment } from '@/lib/chat-attachments';

interface Props {
  attachment: ChatAttachment;
  isSelf: boolean;
}

export function ChatAttachmentCard({ attachment, isSelf }: Props) {
  const { colors } = useTheme();
  const textColor = isSelf ? colors.chatBubbleSelfText : colors.text;
  const subColor = isSelf ? `${textColor}99` : colors.textSecondary;
  const cardBg = isSelf ? 'rgba(255,255,255,0.14)' : colors.surfaceElevated;

  if (attachment.type === 'location') {
    return (
      <Pressable
        onPress={() =>
          openInMaps(attachment.latitude, attachment.longitude, attachment.label)
        }
        style={[styles.card, { backgroundColor: cardBg }]}>
        <LocationMapPreview
          markers={[
            {
              latitude: attachment.latitude,
              longitude: attachment.longitude,
              label: attachment.label,
              color: colors.accent,
            },
          ]}
          height={120}
          interactive={false}
          style={styles.map}
        />
        <View style={styles.locationMeta}>
          <View style={[styles.iconBadge, { backgroundColor: colors.accentSoft }]}>
            <Icon name="location" size={16} color={colors.accent} filled />
          </View>
          <View style={styles.metaText}>
            <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
              {attachment.label}
            </Text>
            <Text style={[styles.sub, { color: subColor }]}>Tap to open in maps</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  if (attachment.type === 'contact') {
    const initial = attachment.name.trim().charAt(0).toUpperCase() || '?';
    return (
      <View style={[styles.card, styles.rowCard, { backgroundColor: cardBg }]}>
        <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.avatarText, { color: colors.accent }]}>{initial}</Text>
        </View>
        <View style={styles.metaText}>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {attachment.name}
          </Text>
          {attachment.phone ? (
            <Text style={[styles.sub, { color: subColor }]} numberOfLines={1}>
              {attachment.phone}
            </Text>
          ) : null}
          {attachment.email ? (
            <Text style={[styles.sub, { color: subColor }]} numberOfLines={1}>
              {attachment.email}
            </Text>
          ) : null}
        </View>
        <Icon name="user" size={18} color={subColor} />
      </View>
    );
  }

  const openFile = () => {
    void Linking.openURL(attachment.url);
  };

  return (
    <Pressable
      onPress={openFile}
      style={[styles.card, styles.rowCard, { backgroundColor: cardBg }]}>
      <View style={[styles.iconBadge, { backgroundColor: colors.accentSoft }]}>
        <Icon name="document" size={20} color={colors.accent} />
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
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  map: { borderRadius: 0 },
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
  metaText: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800' },
});
