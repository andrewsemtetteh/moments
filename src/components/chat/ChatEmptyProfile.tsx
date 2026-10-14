import * as Haptics from '@/lib/haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { FullScreenImageModal } from '@/components/ui/FullScreenImageModal';
import { Avatar } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import type { Relationship, UserProfile } from '@/types/database';

/** First-message nudges — tapping one fills the composer (it never auto-sends). */
const STARTERS = ['Hey you 👋', 'Thinking of you ❤️', "How's your day going?", 'Miss you already 🥺'];

export type ChatEmptyProfileProps = {
  partner: UserProfile | null;
  relationship: Relationship | null;
  isOnline: boolean;
  onOpenProfile: () => void;
  /** Puts a starter line into the composer, ready to edit or send. */
  onPickStarter?: (text: string) => void;
};

/**
 * Empty thread: who you're talking to, a reminder that it's private, and a
 * few one-tap openers — so the very first screen gives you something to do
 * instead of a blank page and a blinking cursor. If the partner hasn't joined
 * yet, it says so plainly instead of showing a generic "Partner".
 */
export function ChatEmptyProfile({
  partner,
  relationship,
  isOnline,
  onOpenProfile,
  onPickStarter,
}: ChatEmptyProfileProps) {
  const { colors } = useTheme();
  const [showPhoto, setShowPhoto] = useState(false);
  const firstName = getFirstName(partner?.name);

  const since = relationship?.created_at
    ? new Date(relationship.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInUp.duration(360)} style={styles.identity}>
        <Pressable
          onPress={() => partner && setShowPhoto(true)}
          disabled={!partner}
          accessibilityRole="button"
          accessibilityLabel="View profile photo">
          <View style={styles.avatarWrap}>
            <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={96} />
            {isOnline && partner ? (
              <View
                style={[styles.onlineDot, { borderColor: colors.background, backgroundColor: colors.success }]}
              />
            ) : null}
          </View>
        </Pressable>

        {partner ? (
          <>
            <Pressable onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel="View partner profile">
              <Text style={[styles.name, { color: colors.text }]}>{partner.name ?? 'Partner'}</Text>
            </Pressable>
            {since ? (
              <Text style={[styles.since, { color: colors.textSecondary }]}>Together since {since}</Text>
            ) : null}
          </>
        ) : (
          <>
            <Text style={[styles.name, { color: colors.text }]}>Waiting for your partner</Text>
            <Text style={[styles.since, { color: colors.textSecondary }]}>
              Once they join, this is where you&apos;ll talk.
            </Text>
          </>
        )}

        <View style={[styles.privacy, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="lock" size={13} color={colors.textSecondary} />
          <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
            Only you two can see this conversation
          </Text>
        </View>
      </Animated.View>

      {partner && onPickStarter ? (
        <Animated.View entering={FadeInUp.delay(140).duration(360)} style={styles.starters}>
          <Text style={[styles.startersLabel, { color: colors.textTertiary }]}>
            {firstName ? `SAY HELLO TO ${firstName.toUpperCase()}` : 'SAY HELLO'}
          </Text>
          <View style={styles.chips}>
            {STARTERS.map((line) => (
              <Pressable
                key={line}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onPickStarter(line);
                }}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: pressed ? colors.accentSoft : colors.surface,
                    borderColor: pressed ? colors.accent : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Start with: ${line}`}>
                <Text style={[styles.chipText, { color: colors.text }]}>{line}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      ) : null}

      <FullScreenImageModal
        visible={showPhoto}
        imageUrl={partner?.avatar_url}
        fallbackName={partner?.name}
        title={partner?.name ?? 'Partner'}
        onClose={() => setShowPhoto(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
    gap: 28,
  },
  identity: { alignItems: 'center', gap: 6 },
  avatarWrap: { marginBottom: 8 },
  onlineDot: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
  },
  name: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  since: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
  privacy: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  privacyText: { fontSize: 12, fontWeight: '600' },
  starters: { alignItems: 'center', gap: 12, width: '100%' },
  startersLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
});
