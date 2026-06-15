import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { groupMomentsByUser, momentHasVisual } from '@/lib/moment-display';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import type { Moment } from '@/types/database';

const RING = 72;
const INNER = 62;

interface MomentsStripProps {
  moments: Moment[];
}

export function MomentsStrip({ moments }: MomentsStripProps) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const setShowMomentCreator = useUIStore((s) => s.setShowMomentCreator);
  const openMomentViewer = useUIStore((s) => s.openMomentViewer);

  const { mine, theirs } = groupMomentsByUser(moments, user?.id ?? '', partner?.id);
  const myLatest = mine[0];
  const partnerLatest = theirs[0];

  const openMine = () => {
    if (mine.length > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      openMomentViewer(mine, 0);
    } else {
      setShowMomentCreator(true);
    }
  };

  const openTheirs = () => {
    if (theirs.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openMomentViewer(theirs, 0);
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <StoryRing
        label="You"
        gradient={colors.gradient}
        hasStory={mine.length > 0}
        onPress={openMine}
        isAdd={mine.length === 0}>
        {myLatest && momentHasVisual(myLatest) ? (
          <Image source={{ uri: myLatest.media_url! }} style={styles.ringImage} contentFit="cover" />
        ) : (
          <View style={[styles.ringPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
            {mine.length === 0 ? (
              <Icon name="plus" size={26} color={colors.accent} />
            ) : (
              <Avatar name={user?.name} imageUrl={user?.avatar_url} size={INNER - 4} />
            )}
          </View>
        )}
      </StoryRing>

      {partner && (
        <StoryRing
          label={partner.name?.split(' ')[0] ?? 'Partner'}
          gradient={['#5b8def', '#9b6bff', '#e85d75']}
          hasStory={theirs.length > 0}
          onPress={openTheirs}
          dimmed={theirs.length === 0}>
          {partnerLatest && momentHasVisual(partnerLatest) ? (
            <Image source={{ uri: partnerLatest.media_url! }} style={styles.ringImage} contentFit="cover" />
          ) : (
            <View style={[styles.ringPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
              <Avatar name={partner.name} imageUrl={partner.avatar_url} size={INNER - 4} />
            </View>
          )}
        </StoryRing>
      )}

      <Pressable
        onPress={() => setShowMomentCreator(true)}
        style={({ pressed }) => [styles.composeChip, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.85 }]}>
        <Icon name="camera" size={18} color={colors.accent} />
        <Text style={[styles.composeText, { color: colors.text }]}>New moment</Text>
      </Pressable>
    </ScrollView>
  );
}

function StoryRing({
  label,
  gradient,
  hasStory,
  onPress,
  children,
  isAdd,
  dimmed,
}: {
  label: string;
  gradient: [string, string] | [string, string, string];
  hasStory: boolean;
  onPress: () => void;
  children: ReactNode;
  isAdd?: boolean;
  dimmed?: boolean;
}) {
  const { colors } = useTheme();
  const ringColors = (hasStory ? gradient : [colors.border, colors.border]) as [string, string];

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.ringItem, pressed && { opacity: 0.88 }]}>
      <LinearGradient colors={ringColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.ringOuter, dimmed && { opacity: 0.45 }]}>
        <View style={[styles.ringInner, { backgroundColor: colors.background }]}>
          {children}
          {isAdd && (
            <View style={[styles.addBadge, { backgroundColor: colors.accent, borderColor: colors.background }]}>
              <Icon name="plus" size={12} color={colors.onAccent} />
            </View>
          )}
        </View>
      </LinearGradient>
      <Text style={[styles.ringLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 4 },
  ringItem: { alignItems: 'center', width: RING + 8 },
  ringOuter: { width: RING, height: RING, borderRadius: RING / 2, alignItems: 'center', justifyContent: 'center' },
  ringInner: { width: INNER, height: INNER, borderRadius: INNER / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  ringImage: { width: INNER, height: INNER },
  ringPlaceholder: { width: INNER, height: INNER, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { fontSize: 11, fontWeight: '600', marginTop: 6, maxWidth: RING + 12, textAlign: 'center' },
  addBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'center',
    marginTop: 18,
  },
  composeText: { fontSize: 13, fontWeight: '700' },
});
