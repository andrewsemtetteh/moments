import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import {
  DraggableSheet,
  SheetScrollView,
} from "@/components/ui/DraggableSheet";
import { SheetHeader, sheetListStyle } from "@/components/ui/SheetHeader";
import { Icon } from "@/components/ui/Icon";
import { colorWithAlpha, outlineColor, separatorColor, trackColor } from "@/components/ui/primitives";
import { StickerFlame } from "@/components/home/StickerFlame";
import { useStreak } from "@/hooks/queries";
import { ShareCardModal } from "@/components/share/ShareCardModal";
import { TrophyShareCard } from "@/components/share/TrophyShareCard";
import { Spacing } from "@/constants/design-system";
import { useTheme } from "@/hooks/useTheme";
import {
  BADGES,
  BADGE_GROUPS,
  type BadgeDef,
  emptyProgress,
  levelInfo,
  nextBadges,
  questView,
  todayKey,
} from "@/lib/play-progress";
import { usePlayProgressStore } from "@/stores/play-progress-store";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function useProgress() {
  const progress = usePlayProgressStore((s) => s.progress);
  return progress ?? emptyProgress(todayKey());
}

/* -------------------------------------------------------------------------- */
/* Hero: level ring, XP, streak                                               */
/* -------------------------------------------------------------------------- */

const RING = 84;
const STROKE = 9;
const RADIUS = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export function LevelRing({
  level,
  progress,
}: {
  level: number;
  progress: number;
}) {
  const { colors } = useTheme();
  const value = useSharedValue(0);
  useEffect(() => {
    value.value = withTiming(progress, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, value]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - value.value),
  }));

  return (
    <View style={styles.ringWrap}>
      <Svg
        width={RING}
        height={RING}
        style={{ transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RADIUS}
          stroke={colorWithAlpha(colors.onAccent, 0.25)}
          strokeWidth={STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={RING / 2}
          cy={RING / 2}
          r={RADIUS}
          stroke={colors.onAccent}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          animatedProps={animatedProps}
          fill="none"
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text
          style={[
            styles.ringLabel,
            { color: colorWithAlpha(colors.onAccent, 0.8) },
          ]}
        >
          LVL
        </Text>
        <Text style={[styles.ringLevel, { color: colors.onAccent }]}>
          {level}
        </Text>
      </View>
    </View>
  );
}

export function PlayHero() {
  const { colors } = useTheme();
  const router = useRouter();
  const progress = useProgress();
  const info = useMemo(() => levelInfo(progress.xp), [progress.xp]);
  const { data: streakStatus } = useStreak();
  const coupleStreak = streakStatus?.current_streak ?? 0;

  return (
    // Tap for the full picture: level road, numbers, trophies close to unlocking.
    <Pressable
      onPress={() => router.push("/play/progress")}
      accessibilityRole="button"
      accessibilityLabel={`Your progress: ${info.title}, level ${info.level}. Open details`}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View
          style={[
            styles.heroGlow,
            { backgroundColor: colorWithAlpha(colors.onAccent, 0.12) },
          ]}
          pointerEvents="none"
        />
        <View style={styles.heroTop}>
          <LevelRing level={info.level} progress={info.progress} />
          <View style={styles.heroCopy}>
            <Text
              style={[
                styles.heroEyebrow,
                { color: colorWithAlpha(colors.onAccent, 0.8) },
              ]}
            >
              YOUR COUPLE LEVEL
            </Text>
            <Text
              style={[styles.heroTitle, { color: colors.onAccent }]}
              numberOfLines={1}
            >
              {info.title}
            </Text>
            <Text
              style={[
                styles.heroXp,
                { color: colorWithAlpha(colors.onAccent, 0.88) },
              ]}
            >
              {info.into} / {info.span} XP · {info.span - info.into} to{" "}
              {info.nextTitle}
            </Text>
          </View>
        </View>

        <View style={styles.heroChips}>
          <View
            style={[
              styles.heroChip,
              { backgroundColor: colorWithAlpha(colors.onAccent, 0.2) },
            ]}
          >
            {/* Your couple streak, the same number as Home, You and the streak page. */}
            <Text style={[styles.heroChipText, { color: colors.onAccent }]}>
              {coupleStreak > 0 ? coupleStreak : "Start a streak"}
            </Text>
            <View style={coupleStreak > 0 ? undefined : styles.idleChipFlame}>
              <StickerFlame size={16} />
            </View>
          </View>
          <View
            style={[
              styles.heroChip,
              { backgroundColor: colorWithAlpha(colors.onAccent, 0.2) },
            ]}
          >
            <Icon name="trophy" size={15} color={colors.onAccent} filled />
            <Text style={[styles.heroChipText, { color: colors.onAccent }]}>
              {progress.badges.length}/{BADGES.length} trophies
            </Text>
          </View>
          <View
            style={[
              styles.heroChip,
              { backgroundColor: colorWithAlpha(colors.onAccent, 0.2) },
            ]}
          >
            <Icon name="star" size={15} color={colors.onAccent} filled />
            <Text style={[styles.heroChipText, { color: colors.onAccent }]}>
              {progress.xp.toLocaleString()} XP
            </Text>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Daily quests                                                               */
/* -------------------------------------------------------------------------- */

export function QuestsCard() {
  const { colors } = useTheme();
  const progress = useProgress();
  const quests = useMemo(() => questView(progress), [progress]);
  const done = quests.filter((q) => q.done).length;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Daily quests
          </Text>
          <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
            Finish them together for bonus XP · {done}/{quests.length} done
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.questCard,
          {
            backgroundColor: colors.isDark
              ? colors.surface
              : colors.surfaceElevated,
            borderColor: outlineColor(colors),
          },
        ]}
      >
        {quests.map((quest, i) => {
          const pct = quest.target > 0 ? quest.count / quest.target : 0;
          return (
            <View
              key={quest.id}
              style={[
                styles.questRow,
                i > 0 && {
                  borderTopWidth: 1,
                  borderTopColor: separatorColor(colors),
                },
              ]}
            >
              <View
                style={[
                  styles.questIcon,
                  {
                    backgroundColor: quest.done
                      ? colors.success
                      : colors.accentSoft,
                  },
                ]}
              >
                <Icon
                  name={quest.done ? "check" : quest.icon}
                  size={20}
                  color={quest.done ? "#FFFFFF" : colors.accent}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text
                  style={[
                    styles.questTitle,
                    {
                      color: colors.text,
                      textDecorationLine: quest.done ? "line-through" : "none",
                      opacity: quest.done ? 0.6 : 1,
                    },
                  ]}
                >
                  {quest.title}
                </Text>
                <View
                  style={[
                    styles.questTrack,
                    { backgroundColor: trackColor(colors) },
                  ]}
                >
                  <View
                    style={[
                      styles.questFill,
                      {
                        width: `${Math.round((quest.done ? 1 : pct) * 100)}%`,
                        backgroundColor: quest.done
                          ? colors.success
                          : colors.accent,
                      },
                    ]}
                  />
                </View>
              </View>
              <View
                style={[
                  styles.rewardChip,
                  {
                    backgroundColor: quest.done
                      ? colors.success
                      : colors.accentSoft,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.rewardText,
                    { color: quest.done ? "#fff" : colors.accent },
                  ]}
                >
                  {quest.done ? "Done" : `+${quest.reward} XP`}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                     */
/* -------------------------------------------------------------------------- */

export function BadgesShelf() {
  const { colors } = useTheme();
  const progress = useProgress();
  const [open, setOpen] = useState(false);
  // An unlocked trophy being shared, like an achievement.
  const [sharing, setSharing] = useState<BadgeDef | null>(null);
  const owned = new Set(progress.badges);
  /** From the Trophy room: let its sheet close first (a second Modal wouldn't show on iPhone). */
  const shareFromRoom = (badge: BadgeDef) => {
    setOpen(false);
    setTimeout(() => setSharing(badge), 380);
  };
  // On the shelf: the next trophy on each ladder (closest first, with how far along you
  // are), then the ones you've won, newest first.
  const chase = nextBadges(progress, 8);
  const won = [...progress.badges]
    .reverse()
    .flatMap((id) => BADGES.find((b) => b.id === id) ?? []);
  const shelf: { badge: BadgeDef; value?: number }[] = [
    ...chase.map((c) => ({ badge: c.badge, value: c.value })),
    ...won.map((badge) => ({ badge })),
  ];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Trophy shelf
          </Text>
          <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
            {owned.size} of {BADGES.length} unlocked
          </Text>
        </View>
        <Pressable
          onPress={() => setOpen(true)}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={[styles.seeAll, { color: colors.accent }]}>See all</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        alwaysBounceHorizontal={false}
        showsHorizontalScrollIndicator={false}
        style={styles.hBleed}
        contentContainerStyle={styles.tiles}
      >
        {shelf.map(({ badge, value }) => {
          const has = owned.has(badge.id);
          return (
            <Pressable
              key={badge.id}
              disabled={!has}
              onPress={() => setSharing(badge)}
              accessibilityRole={has ? "button" : undefined}
              accessibilityLabel={
                has ? `${badge.title}, share` : `${badge.title}, locked`
              }
              style={({ pressed }) => [
                styles.badge,
                {
                  backgroundColor: colors.isDark
                    ? colors.surface
                    : colors.surfaceElevated,
                  borderColor: has ? colors.accent : outlineColor(colors),
                },
                pressed && styles.pressed,
              ]}
            >
              {has ? (
                <View
                  style={[styles.shareDot, { backgroundColor: colors.accent }]}
                >
                  <Icon name="share" size={11} color={colors.onAccent} />
                </View>
              ) : null}
              {has ? (
                <View
                  style={[
                    styles.badgeMedal,
                    { backgroundColor: colors.accentSoft },
                  ]}
                >
                  <Icon
                    name={badge.icon}
                    size={22}
                    color={colors.accent}
                    filled
                  />
                </View>
              ) : (
                <View style={styles.lockSlot}>
                  <Icon name="lock" size={28} color={colors.textTertiary} />
                </View>
              )}
              <Text
                style={[
                  styles.badgeTitle,
                  { color: has ? colors.text : colors.textTertiary },
                ]}
                numberOfLines={1}
              >
                {badge.title}
              </Text>
              <Text
                style={[styles.badgeHint, { color: colors.textTertiary }]}
                numberOfLines={2}
              >
                {badge.hint}
              </Text>
              {!has && value !== undefined ? (
                <View style={styles.badgeProgress}>
                  <View
                    style={[
                      styles.badgeTrack,
                      { backgroundColor: trackColor(colors) },
                    ]}
                  >
                    <View
                      style={[
                        styles.badgeFill,
                        {
                          backgroundColor: colors.accent,
                          width: `${Math.round((value / badge.goal) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[styles.badgeCount, { color: colors.textSecondary }]}
                  >
                    {value.toLocaleString()} / {badge.goal.toLocaleString()}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <DraggableSheet
        visible={open}
        onClose={() => setOpen(false)}
        dragAnywhere
      >
        <SheetHeader
          title="Trophy room"
          hint={`${owned.size} of ${BADGES.length} unlocked · tap one you've won to share it`}
          onClose={() => setOpen(false)}
        />
        <SheetScrollView contentContainerStyle={styles.trophyRoom}>
          {BADGE_GROUPS.map((group) => {
            const ladder = BADGES.filter((b) => b.group === group);
            const got = ladder.filter((b) => owned.has(b.id)).length;
            return (
              <View key={group} style={styles.trophyGroup}>
                <View style={styles.trophyGroupHead}>
                  <Text
                    style={[styles.trophyGroupTitle, { color: colors.text }]}
                  >
                    {group}
                  </Text>
                  <Text
                    style={[
                      styles.trophyGroupCount,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {got} of {ladder.length}
                  </Text>
                </View>
                <View style={[styles.trophyGrid, styles.trophyGridCard, ...sheetListStyle(colors)]}>
                  {ladder.map((badge) => {
                    const has = owned.has(badge.id);
                    return (
                      <Pressable
                        key={badge.id}
                        disabled={!has}
                        onPress={() => shareFromRoom(badge)}
                        accessibilityRole={has ? "button" : undefined}
                        accessibilityLabel={
                          has
                            ? `${badge.title}, share`
                            : `${badge.title}, locked`
                        }
                        style={({ pressed }) => [
                          styles.trophyItem,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.trophyIcon,
                            {
                              backgroundColor: has
                                ? colors.accentSoft
                                : colors.surface,
                              borderColor: has ? colors.accent : outlineColor(colors),
                            },
                          ]}
                        >
                          {has ? (
                            <Icon
                              name={badge.icon}
                              size={28}
                              color={colors.accent}
                              filled
                            />
                          ) : (
                            <Icon
                              name="lock"
                              size={24}
                              color={colors.textTertiary}
                            />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.trophyName,
                            { color: has ? colors.text : colors.textTertiary },
                          ]}
                          numberOfLines={1}
                        >
                          {badge.title}
                        </Text>
                        <Text
                          style={[
                            styles.trophyHint,
                            { color: colors.textTertiary },
                          ]}
                          numberOfLines={2}
                        >
                          {badge.hint}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </SheetScrollView>
      </DraggableSheet>

      {/* An unlocked trophy, shared like an achievement. */}
      <ShareCardModal
        visible={!!sharing}
        onClose={() => setSharing(null)}
        title="Share your trophy"
      >
        {sharing ? (
          <TrophyShareCard
            icon={sharing.icon}
            title={sharing.title}
            hint={sharing.hint}
          />
        ) : null}
      </ShareCardModal>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, padding: 18, gap: 16, overflow: "hidden" },
  heroGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -70,
    right: -50,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  ringWrap: {
    width: RING,
    height: RING,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: { position: "absolute", alignItems: "center" },
  ringLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  ringLevel: { fontSize: 30, fontWeight: "900", lineHeight: 34 },
  heroCopy: { flex: 1, gap: 2 },
  heroEyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  heroTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  heroXp: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  avatars: { flexDirection: "row", alignItems: "center" },
  avatarOverlap: { marginLeft: -12 },
  heroChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heroChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  heroChipText: { fontSize: 12, fontWeight: "800" },

  section: { marginTop: 22, gap: 12 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  sectionSub: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  seeAll: { fontSize: 14, fontWeight: "800" },

  hBleed: { marginHorizontal: -Spacing.lg },
  tiles: { gap: 12, paddingHorizontal: Spacing.lg, paddingBottom: 6 },

  questCard: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
  },
  questRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  questIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  questTitle: { fontSize: 15, fontWeight: "800" },
  questTrack: { height: 7, borderRadius: 4, overflow: "hidden" },
  questFill: { height: 7, borderRadius: 4 },
  rewardChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  rewardText: { fontSize: 12, fontWeight: "900" },

  // A trophy on the shelf: everything centred, both ways (the share mark stays in its corner).
  badge: {
    width: 152,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 12,
    gap: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeMedal: {
    width: 41,
    height: 41,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  lockSlot: { height: 41, alignItems: "center", justifyContent: "center" },
  badgeTitle: { fontSize: 13, fontWeight: "900", textAlign: "center" },
  badgeHint: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  sheetTitle: { fontSize: 22, fontWeight: "900", marginBottom: 12 },
  pressed: { opacity: 0.75 },
  idleChipFlame: { opacity: 0.5 },
  // A small share mark on an unlocked trophy: tap it to share.
  shareDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  trophyRoom: { gap: 22, paddingBottom: 24 },
  trophyGroup: { gap: 12 },
  trophyGroupHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  trophyGroupTitle: { fontSize: 16, fontWeight: "900" },
  trophyGroupCount: { fontSize: 12, fontWeight: "700" },
  trophyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  trophyGridCard: { padding: 14, overflow: "visible" },
  badgeProgress: { alignSelf: "stretch", gap: 4, marginTop: 4 },
  badgeTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
  badgeFill: { height: 5, borderRadius: 3 },
  badgeCount: { fontSize: 10, fontWeight: "800", textAlign: "center" },
  trophyItem: { width: "30%", alignItems: "center", gap: 4 },
  trophyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  trophyEmoji: { fontSize: 30 },
  trophyName: { fontSize: 12, fontWeight: "900", textAlign: "center" },
  trophyHint: { fontSize: 10, fontWeight: "600", textAlign: "center" },
});
