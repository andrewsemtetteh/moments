import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';

export type ExploreModalKey =
  | 'cards'
  | 'games'
  | 'quiz'
  | 'bucket'
  | 'goals'
  | 'gratitude'
  | 'daily'
  | 'trivia'
  | 'quizLive'
  | 'compliment'
  | 'twoTruths'
  | 'truth'
  | 'memory'
  | 'playlist';

interface ExploreItem {
  id: ExploreModalKey;
  title: string;
  tagline: string;
  icon: IconName;
  accent: string;
}

const FEATURED: ExploreItem = {
  id: 'cards',
  title: 'Conversation Cards',
  tagline: 'Deep, funny & romantic prompts to spark real talk',
  icon: 'cards',
  accent: '💬',
};

const CONNECT_ITEMS: ExploreItem[] = [
  { id: 'games', title: 'Mini Games', tagline: 'Would you rather, this or that…', icon: 'gamepad', accent: '🎲' },
  { id: 'quizLive', title: 'Quiz Live', tagline: 'Live quiz on any topic from your own phones', icon: 'globe', accent: '🌐' },
  { id: 'quiz', title: 'Love Language', tagline: 'Discover how you each feel loved', icon: 'heart', accent: '💞' },
  { id: 'truth', title: 'Truth or Dare', tagline: 'Couples-safe cards', icon: 'fire', accent: '🔥' },
  { id: 'twoTruths', title: 'Two Truths & a Lie', tagline: 'Guess the fib', icon: 'eye', accent: '🃏' },
  { id: 'memory', title: 'Memory Quiz', tagline: 'How well do you remember?', icon: 'journal', accent: '🧩' },
];

const DAILY_ITEMS: ExploreItem[] = [
  { id: 'gratitude', title: 'Gratitude Swap', tagline: '3 things you appreciated today', icon: 'heart', accent: '🙏' },
  { id: 'daily', title: 'Question of the Day', tagline: 'One light prompt to spark talk', icon: 'journal', accent: '💭' },
  { id: 'compliment', title: 'Compliment Jar', tagline: 'Notes for your partner to open', icon: 'gift', accent: '💝' },
  { id: 'trivia', title: 'Couples Trivia', tagline: 'Fun facts about love & us', icon: 'star', accent: '🧠' },
  { id: 'playlist', title: 'Playlist for Two', tagline: 'Pick a song for each other', icon: 'volumeHigh', accent: '🎵' },
];

const PLAN_ITEMS: ExploreItem[] = [
  { id: 'bucket', title: 'Bucket List', tagline: 'Dreams to chase together', icon: 'list', accent: '✈️' },
  { id: 'goals', title: 'Shared Goals', tagline: 'Track progress as a team', icon: 'target', accent: '🎯' },
];

const GRID_GAP = Spacing.md;
const SCREEN_PAD = Spacing.lg;

interface ExploreSectionProps {
  onOpen: (key: ExploreModalKey) => void;
}

export function ExploreSection({ onOpen }: ExploreSectionProps) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = windowWidth - SCREEN_PAD * 2;
  const tileWidth = (contentWidth - GRID_GAP) / 2;

  const open = (key: ExploreModalKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOpen(key);
  };

  return (
    <View style={styles.section}>
      {/* Previous explore header — swap with sectionIntro below to restore
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>IN THE APP</Text>
        <Text style={[styles.title, { color: colors.text }]}>Explore</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Pick an activity below
        </Text>
      </View>
      */}

      <View style={styles.sectionIntro}>
        <View style={[styles.sectionRule, { backgroundColor: colors.border }]} />
        <Text style={[styles.sectionIntroText, { color: colors.textSecondary }]}>More to explore</Text>
        <View style={[styles.sectionRule, { backgroundColor: colors.border }]} />
      </View>

      <Pressable onPress={() => open(FEATURED.id)} style={styles.featuredPress}>
        <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featured}>
          <View style={styles.featuredGlow} pointerEvents="none" />
          <Text style={styles.featuredEmoji}>{FEATURED.accent}</Text>
          <View style={styles.featuredBody}>
            <View style={styles.featuredIcon}>
              <Icon name={FEATURED.icon} size={22} color="#fff" filled />
            </View>
            <View style={styles.featuredCopy}>
              <Text style={styles.featuredTitle}>{FEATURED.title}</Text>
              <Text style={styles.featuredTagline}>{FEATURED.tagline}</Text>
            </View>
            <View style={styles.featuredArrow}>
              <Icon name="chevronRight" size={18} color="#fff" />
            </View>
          </View>
        </LinearGradient>
      </Pressable>

      <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>Connect & play</Text>
      <ExploreItemGrid items={CONNECT_ITEMS} onOpen={open} tileWidth={tileWidth} contentWidth={contentWidth} />

      <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>Daily sparks</Text>
      <ExploreItemGrid items={DAILY_ITEMS} onOpen={open} tileWidth={tileWidth} contentWidth={contentWidth} />

      <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>Plan together</Text>
      <View style={styles.planStack}>
        <ExploreWideTile item={PLAN_ITEMS[0]} onPress={() => open(PLAN_ITEMS[0].id)} width={contentWidth} />
        <ExploreWideTile item={PLAN_ITEMS[1]} onPress={() => open(PLAN_ITEMS[1].id)} width={contentWidth} />
      </View>
    </View>
  );
}

function ExploreItemGrid({
  items,
  onOpen,
  tileWidth,
  contentWidth,
}: {
  items: ExploreItem[];
  onOpen: (key: ExploreModalKey) => void;
  tileWidth: number;
  contentWidth: number;
}) {
  const hasLoneTail = items.length % 2 === 1;
  const pairedItems = hasLoneTail ? items.slice(0, -1) : items;
  const loneItem = hasLoneTail ? items[items.length - 1] : null;

  return (
    <View style={[styles.itemGrid, { width: contentWidth }]}>
      {pairedItems.map((item) => (
        <ExploreTile key={item.id} item={item} onPress={() => onOpen(item.id)} width={tileWidth} />
      ))}
      {loneItem ? (
        <ExploreWideTile item={loneItem} onPress={() => onOpen(loneItem.id)} width={contentWidth} />
      ) : null}
    </View>
  );
}

function ExploreTile({
  item,
  onPress,
  width,
}: {
  item: ExploreItem;
  onPress: () => void;
  width: number;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tile,
        { width, backgroundColor: colors.surfaceElevated, borderColor: colors.border },
      ]}>
      <Text style={styles.tileEmoji}>{item.accent}</Text>
      <View style={[styles.tileIcon, { backgroundColor: colors.accentSoft }]}>
        <Icon name={item.icon} size={20} color={colors.accent} filled />
      </View>
      <View style={styles.tileBody}>
        <Text style={[styles.tileTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.tileTagline, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.tagline}
        </Text>
      </View>
      <View style={styles.tileFooter}>
        <View style={[styles.tileArrow, { backgroundColor: colors.surface }]}>
          <Icon name="chevronRight" size={14} color={colors.textSecondary} />
        </View>
      </View>
    </Pressable>
  );
}

function ExploreWideTile({
  item,
  onPress,
  width,
}: {
  item: ExploreItem;
  onPress: () => void;
  width: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.wideTile, { width, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <Text style={styles.wideEmoji}>{item.accent}</Text>
      <View style={[styles.wideIcon, { backgroundColor: colors.accentSoft }]}>
        <Icon name={item.icon} size={20} color={colors.accent} filled />
      </View>
      <View style={styles.wideCopy}>
        <Text style={[styles.wideTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.wideTagline, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.tagline}
        </Text>
      </View>
      <View style={[styles.wideArrow, { backgroundColor: colors.surface }]}>
        <Icon name="chevronRight" size={14} color={colors.textSecondary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 8, gap: 20 },
  sectionIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 2,
  },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth },
  sectionIntroText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  // Previous explore header styles — uncomment with header block above
  // header: { gap: 4 },
  // eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  // title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  // subtitle: { fontSize: 14, lineHeight: 20, marginTop: 4, maxWidth: 320 },
  featuredPress: { borderRadius: 22, overflow: 'hidden' },
  featured: {
    minHeight: 148,
    padding: 18,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  featuredGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.12)',
    top: -50,
    right: -30,
  },
  featuredEmoji: {
    position: 'absolute',
    top: 12,
    right: 16,
    fontSize: 36,
    opacity: 0.35,
  },
  featuredBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featuredIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredCopy: { flex: 1, gap: 4 },
  featuredTitle: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.2 },
  featuredTagline: { color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 18, fontWeight: '500' },
  featuredArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tile: {
    minHeight: 168,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    overflow: 'hidden',
  },
  tileEmoji: { position: 'absolute', top: 8, right: 10, fontSize: 28, opacity: 0.2 },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileBody: { flex: 1, gap: 4, paddingRight: 4 },
  tileTitle: { fontSize: 15, fontWeight: '800', lineHeight: 19 },
  tileTagline: { fontSize: 12, lineHeight: 16 },
  tileFooter: { alignItems: 'flex-end', marginTop: 10 },
  tileArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planStack: { gap: 12 },
  wideTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 88,
    padding: 14,
    paddingRight: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  wideEmoji: {
    position: 'absolute',
    top: 8,
    right: 48,
    fontSize: 28,
    opacity: 0.2,
  },
  wideIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  wideCopy: { flex: 1, gap: 3, minWidth: 0, paddingRight: 4 },
  wideTitle: { fontSize: 15, fontWeight: '800', lineHeight: 19 },
  wideTagline: { fontSize: 12, lineHeight: 16 },
  wideArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: 2,
  },
});
