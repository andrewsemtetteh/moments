import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';

import { ActivityArt } from '@/components/activities/explore/ActivityArt';
import { Icon } from '@/components/ui/Icon';
import { Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';

import {
    getPlayTone,
    HOME_FILTERS,
    PLAY_GROUPS,
    sectionsForFilter,
    type ExploreModalKey,
    type HomeFilterId,
    type PlayActivity,
    type PlayGroupId,
} from './explore/explore-catalog';

export type { ExploreModalKey };

interface ExploreSectionProps {
  onOpen: (key: ExploreModalKey) => void;
}

/** Soft card corners vs tighter controls (search / chips / Play). */
const CARD_RADIUS = 28;
const CONTROL_RADIUS = 12;

type ViewState =
  | { kind: 'home' }
  | { kind: 'library'; groupId: PlayGroupId };

export function ExploreSection({ onOpen }: ExploreSectionProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<HomeFilterId>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewState>({ kind: 'home' });

  const open = (key: ExploreModalKey) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOpen(key);
  };

  if (view.kind === 'library') {
    const group = PLAY_GROUPS.find((g) => g.id === view.groupId);
    const items =
      sectionsForFilter(view.groupId, '').find((s) => s.group.id === view.groupId)?.items ?? [];
    const listWidth = width - Spacing.lg * 2;

    return (
      <View style={styles.section}>
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            setView({ kind: 'home' });
          }}
          style={styles.backRow}
          accessibilityRole="button"
          accessibilityLabel="Back to explore">
          <Icon name="chevronLeft" size={18} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Explore</Text>
        </Pressable>

        <Text style={[styles.libraryTitle, { color: colors.text }]}>
          {group?.label ?? 'All'}
        </Text>
        <Text style={[styles.librarySub, { color: colors.textSecondary }]}>
          {items.length} {items.length === 1 ? 'activity' : 'activities'}
        </Text>

        <View style={styles.libraryList}>
          {items.map((activity) => (
            <FeatureCard
              key={activity.id}
              activity={activity}
              width={listWidth}
              onPress={() => open(activity.id)}
            />
          ))}
        </View>
      </View>
    );
  }

  const sections = sectionsForFilter(filter, query);
  const cardWidth = Math.min(332, width - Spacing.lg * 2 - 38);

  return (
    <View style={styles.section}>
      <View style={styles.sectionIntro}>
        <View style={[styles.sectionRule, { backgroundColor: colors.borderStrong }]} />
        <Text style={[styles.sectionIntroText, { color: colors.textSecondary }]}>More to explore</Text>
        <View style={[styles.sectionRule, { backgroundColor: colors.borderStrong }]} />
      </View>

      <View
        style={[
          styles.search,
          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        ]}>
        <Icon name="search" size={18} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search games, prompts & more."
          placeholderTextColor={colors.textTertiary}
          style={[styles.searchInput, { color: colors.text }]}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.hBleed}
        contentContainerStyle={styles.chipRow}>
        {HOME_FILTERS.map((chip) => {
          const active = filter === chip.id;
          return (
            <Pressable
              key={chip.id}
              onPress={() => {
                void Haptics.selectionAsync();
                setFilter(chip.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: colors.text }
                  : {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      borderWidth: StyleSheet.hairlineWidth,
                    },
              ]}>
              <Text style={[styles.chipText, { color: active ? colors.background : colors.text }]}>
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {sections.map(({ group, items }) => (
        <View key={group.id} style={styles.block}>
          <View style={styles.blockHeader}>
            <Text style={[styles.blockTitle, { color: colors.text }]}>{group.label}</Text>
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                setQuery('');
                setView({ kind: 'library', groupId: group.id });
              }}
              hitSlop={8}>
              <Text style={[styles.seeAll, { color: colors.accent }]}>See all</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={cardWidth + 12}
            snapToAlignment="start"
            disableIntervalMomentum
            style={styles.hBleed}
            contentContainerStyle={styles.carousel}>
            {items.map((activity) => (
              <FeatureCard
                key={activity.id}
                activity={activity}
                width={cardWidth}
                onPress={() => open(activity.id)}
              />
            ))}
          </ScrollView>
        </View>
      ))}

      {sections.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>No matches yet.</Text>
      ) : null}
    </View>
  );
}

function FeatureCard({
  activity,
  width,
  onPress,
}: {
  activity: PlayActivity;
  width: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const cta = activity.cta ?? 'Play';
  const tone = getPlayTone(activity.tone);
  const wash = colors.isDark ? tone.darkWash : tone.wash;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${cta} ${activity.title}`}
      style={[
        styles.card,
        {
          width,
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.isDark ? colors.border : tone.soft,
          shadowColor: tone.accent,
        },
      ]}>
      <LinearGradient
        colors={wash}
        start={{ x: 0, y: 0.35 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.cardCopy}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
          {activity.title}
        </Text>
        <Text style={[styles.cardTagline, { color: colors.textSecondary }]} numberOfLines={2}>
          {activity.tagline}
        </Text>
        <View style={[styles.cta, { backgroundColor: tone.accent }]}>
          <Text style={styles.ctaTextOnAccent}>{cta}</Text>
        </View>
      </View>

      <View style={styles.artWrap}>
        <ActivityArt id={activity.art} size={116} accent={tone.accent} soft={tone.soft} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
    gap: 18,
  },
  sectionIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  sectionRule: {
    flex: 1,
    height: 1,
    minWidth: 24,
    borderRadius: 1,
  },
  sectionIntroText: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: CONTROL_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    padding: 0,
  },
  chipRow: {
    gap: 8,
    paddingHorizontal: Spacing.lg,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: CONTROL_RADIUS,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  block: {
    gap: 12,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 2,
  },
  blockTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '700',
  },
  /** Bleed past screen padding so cards leave at the real screen edge (no inset “peel”). */
  hBleed: {
    marginHorizontal: -Spacing.lg,
  },
  carousel: {
    gap: 12,
    paddingHorizontal: Spacing.lg,
  },
  card: {
    minHeight: 176,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 22,
    paddingLeft: 20,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  cardCopy: {
    flex: 1,
    gap: 8,
    paddingRight: 6,
    zIndex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cardTagline: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: CONTROL_RADIUS,
  },
  ctaTextOnAccent: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  artWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 24,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 15,
    fontWeight: '700',
  },
  libraryTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: -4,
  },
  librarySub: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: -8,
  },
  libraryList: {
    gap: 12,
  },
});
