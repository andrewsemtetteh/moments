import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays, format, startOfYear } from 'date-fns';
import * as Haptics from '@/lib/haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRef, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  LayoutAnimationConfig,
  FadeIn,
  FadeInDown,
  FadeInUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StickerFlame } from '@/components/home/StickerFlame';
import { ShareBrand } from '@/components/share/ShareBrand';
import { ShareCardModal } from '@/components/share/ShareCardModal';
import { SHARE_CARD_H, SHARE_CARD_W } from '@/components/share/DaysTogetherCard';
import { WrappedShareCard, type WrappedStat } from '@/components/share/WrappedShareCard';
import { Icon, type IconName } from '@/components/ui/Icon';
import { MOOD_EMOJI, MOOD_LABELS } from '@/constants/design-system';
import { useDailyChallengeHistory, useMemoryEntries, useMoments, useMoodFrequency, useStreak } from '@/hooks/queries';
import { getRelationshipAnniversaryDate } from '@/lib/anniversary';
import { getFirstName } from '@/lib/avatar-initial';
import { isPromptComplete, myPromptResponse, partnerPromptResponse } from '@/lib/daily-prompt';
import { isPlanCompleted, MEMORY_TYPES, parsePlanMeta, PLAN_KIND_OPTIONS } from '@/lib/plan-meta';
import { BADGES, emptyProgress, levelInfo, todayKey } from '@/lib/play-progress';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import { usePlayProgressStore } from '@/stores/play-progress-store';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
/** Sticker style, like the streak and anniversary designs: black ink on bright pastel. */
const INK = '#000000';
const SOFT = 'rgba(0,0,0,0.68)';
const FAINT = 'rgba(0,0,0,0.14)';
const PAPER = '#FFFFFF';
/** One pastel per story, in turn. */
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Slide = { key: string; colors: [string, string, ...string[]]; body: ReactNode };
type MomentStat = { id: string; user_id: string; type: string; created_at: string };

/**
 * Wrapped: your year together as full-screen story cards. Tap the right side
 * for the next card and the left for the previous one; swipe down (or X) to
 * close. Every card is laid out the same way (centred, one big idea), and any
 * card without data behind it is skipped.
 */
export function WrappedModal() {
  const visible = useUIStore((s) => s.showWrapped);
  const setVisible = useUIStore((s) => s.setShowWrapped);
  if (!visible) return null;
  const close = () => setVisible(false);
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={close}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <WrappedStory onClose={close} />
      </GestureHandlerRootView>
    </Modal>
  );
}

function formatHour(h: number) {
  if (h === 0) return 'midnight';
  if (h === 12) return 'noon';
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

function WrappedStory({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const user = useAuthStore((s) => s.user);
  const { data: streak } = useStreak();
  const { data: moods = [] } = useMoodFrequency();
  const { data: memories = [] } = useMemoryEntries();
  const { data: momentsData } = useMoments();
  const { data: questions = [] } = useDailyChallengeHistory();

  const now = useMemo(() => new Date(), []);
  const year = now.getFullYear();
  const yearStart = useMemo(() => startOfYear(now), [now]);
  const { data: yearMoments = [] } = useQuery({
    queryKey: ['wrapped', relationship?.id, year],
    queryFn: () => api.fetchMomentStatsSince(relationship!.id, yearStart.toISOString()),
    enabled: !!relationship?.id,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['wrapped-plans', relationship?.id, year],
    queryFn: () => api.fetchCalendarEventsInRange(relationship!.id, yearStart, now),
    enabled: !!relationship?.id,
  });
  const { data: yearQuestions } = useQuery({
    queryKey: ['wrapped-questions', relationship?.id, year],
    queryFn: () => api.fetchDailyChallengeHistory(relationship!.id, 400),
    enabled: !!relationship?.id,
  });
  const { data: moodLogs = [] } = useQuery({
    queryKey: ['wrapped-moods', relationship?.id, year],
    queryFn: () => api.fetchMoodLogsSince(relationship!.id, yearStart.toISOString()),
    enabled: !!relationship?.id,
  });
  const playProgress = usePlayProgressStore((s) => s.progress);

  const me = getFirstName(user?.name) ?? 'You';
  const them = getFirstName(partner?.name) ?? 'your partner';

  const { slides, coupleType } = useMemo(() => {
    const list: Slide[] = [];
    let coupleType: CoupleType = { icon: 'diamond', name: 'The Sweethearts', line: '', why: '' };
    const stats = yearMoments as MomentStat[];
    const total = stats.length;
    const longest = Math.max(streak?.longest_streak ?? 0, streak?.current_streak ?? 0);

    // ── Intro
    list.push({
      key: 'intro',
      colors: ['#F1C6CE', '#EAA9DA'],
      body: (
        <>
          <Eyebrow>{relationship?.relationship_name?.trim() || 'Moments'} · Wrapped</Eyebrow>
          <Big>{year}</Big>
          <Title>
            {me} & {them},{'\n'}this was your year.
          </Title>
          <Hint>Tap to begin</Hint>
        </>
      ),
    });

    // ── Days together
    const together = relationship ? getRelationshipAnniversaryDate(relationship) : yearStart;
    const from = together > yearStart ? together : yearStart;
    const days = Math.max(1, differenceInCalendarDays(now, from) + 1);
    list.push({
      key: 'days',
      colors: ['#C6E4F1', '#A9D7EA'],
      body: (
        <>
          <Eyebrow>Days together this year</Eyebrow>
          <Big>{days}</Big>
          <Body>
            {together > yearStart
              ? `Since ${format(together, 'd MMMM')}, when it all began.`
              : 'Every single one of them, since 1 January.'}
          </Body>
        </>
      ),
    });

    // ── Moments shared + who sent more
    const mine = stats.filter((m) => m.user_id === user?.id).length;
    list.push({
      key: 'moments',
      colors: ['#F2D0C4', '#C0A9EA'],
      body: (
        <>
          <Eyebrow>Moments shared</Eyebrow>
          <Big>{total}</Big>
          {total > 0 ? (
            <>
              <Body>
                {mine === total - mine
                  ? 'Perfectly even. Of course it is.'
                  : mine > total - mine
                    ? `You sent a few more. ${them} owes you some.`
                    : `${them} sent a few more. Your turn.`}
              </Body>
              <SplitBar left={mine} right={total - mine} leftLabel="You" rightLabel={them} />
            </>
          ) : (
            <Body>Your first moment of the year is still out there. Send one today.</Body>
          )}
        </>
      ),
    });

    if (total > 0) {
      // ── First moment of the year
      const first = new Date(stats[0].created_at);
      const firstBy = stats[0].user_id === user?.id ? 'You' : them;
      list.push({
        key: 'first',
        colors: ['#D6C6F1', '#C2A9EA'],
        body: (
          <>
            <Eyebrow>Where it started</Eyebrow>
            <Title>{format(first, 'EEEE d MMMM')}</Title>
            <Body>
              {firstBy} sent the year’s very first moment at {format(first, 'h:mm a')}.
            </Body>
          </>
        ),
      });

      // ── A few favourites (photos from what's loaded)
      const photos = (momentsData?.pages.flat() ?? [])
        .filter((m) => m.media_url && m.type === 'photo' && new Date(m.created_at) >= yearStart)
        .slice(0, 6)
        .map((m) => m.media_url as string);
      if (photos.length >= 3) {
        list.push({
          key: 'photos',
          colors: ['#F1C6C6', '#E6A9EA'],
          body: (
            <>
              <Eyebrow>Some of your moments</Eyebrow>
              <Animated.View entering={FadeIn.delay(120).duration(500)} style={styles.collage}>
                {photos.map((uri, i) => (
                  <Animated.View
                    key={uri}
                    entering={FadeInUp.delay(160 + i * 90).duration(420)}
                    style={[styles.collageTile, { transform: [{ rotate: `${[-6, 4, -3, 5, -4, 3][i] ?? 0}deg` }] }]}>
                    <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  </Animated.View>
                ))}
              </Animated.View>
            </>
          ),
        });
      }

      // ── Busiest month
      const perMonth = Array.from({ length: 12 }, () => 0);
      for (const m of stats) perMonth[new Date(m.created_at).getMonth()] += 1;
      const topMonth = perMonth.indexOf(Math.max(...perMonth));
      list.push({
        key: 'month',
        colors: ['#C6CEF1', '#A9B3EA'],
        body: (
          <>
            <Eyebrow>Your biggest month</Eyebrow>
            <Title>{format(new Date(year, topMonth, 1), 'MMMM')}</Title>
            <Body>
              {perMonth[topMonth]} moment{perMonth[topMonth] === 1 ? '' : 's'}. Something good was happening.
            </Body>
            <Bars values={perMonth.slice(0, now.getMonth() + 1)} labels={MONTHS} highlight={topMonth} />
          </>
        ),
      });

      // ── Favourite day of the week
      const perDay = Array.from({ length: 7 }, () => 0);
      for (const m of stats) perDay[new Date(m.created_at).getDay()] += 1;
      const topDay = perDay.indexOf(Math.max(...perDay));
      list.push({
        key: 'weekday',
        colors: ['#BEE3F8', '#A9EAEA'],
        body: (
          <>
            <Eyebrow>Your favourite day</Eyebrow>
            <Title>You two love a {WEEKDAYS[topDay]}.</Title>
            <Bars values={perDay} labels={WEEKDAYS.map((d) => d[0])} highlight={topDay} />
          </>
        ),
      });

      // ── Time of day
      const perHour = Array.from({ length: 24 }, () => 0);
      for (const m of stats) perHour[new Date(m.created_at).getHours()] += 1;
      const topHour = perHour.indexOf(Math.max(...perHour));
      const night =
        perHour
          .slice(20)
          .concat(perHour.slice(0, 5))
          .reduce((a, b) => a + b, 0) / total;
      const morning = perHour.slice(5, 11).reduce((a, b) => a + b, 0) / total;
      list.push({
        key: 'hour',
        colors: night > 0.4 ? ['#CAC6F1', '#AFA9EA'] : ['#FAD9BC', '#F8E19B'],
        body: (
          <>
            <IconBadge icon={night > 0.4 ? 'moon' : 'sunny'} />
            <Eyebrow>Your golden hour</Eyebrow>
            <Title>Around {formatHour(topHour)}</Title>
            <Body>
              {night > 0.4
                ? 'Night owls. Your best moments happen after dark.'
                : morning > 0.4
                  ? 'Early birds. You start the day with each other.'
                  : 'That’s when you two check in the most.'}
            </Body>
          </>
        ),
      });

      // ── What you share
      const photosN = stats.filter((m) => m.type === 'photo').length;
      const videosN = stats.filter((m) => m.type === 'video').length;
      const voiceN = stats.filter((m) => m.type === 'voice').length;
      const otherN = total - photosN - videosN - voiceN;
      list.push({
        key: 'types',
        colors: ['#D9C6F1', '#A9BAEA'],
        body: (
          <>
            <Eyebrow>What you shared</Eyebrow>
            <StatRows
              rows={[
                { icon: 'camera', label: 'Photos', n: photosN },
                { icon: 'videocam', label: 'Videos', n: videosN },
                { icon: 'mic', label: 'Voice notes', n: voiceN },
                { icon: 'sparkles', label: 'Everything else', n: otherN },
              ]}
            />
          </>
        ),
      });
    }

    // ── Streak
    list.push({
      key: 'streak',
      colors: ['#FCC6BB', '#F7B69C'],
      body: (
        <>
          <Animated.View entering={FadeIn.duration(500)}>
            <StickerFlame size={120} face={longest > 0} animated={longest > 0} />
          </Animated.View>
          <Eyebrow>Longest streak</Eyebrow>
          <Big>{longest}</Big>
          <Body>
            {longest > 0
              ? `days in a row you both showed up.${streak?.current_streak ? ` You’re on ${streak.current_streak} right now.` : ''}`
              : 'Show up together two days running to light your first one.'}
          </Body>
        </>
      ),
    });

    // ── Moods: what each of you felt most this year
    const topMood = (uid: string | undefined) => {
      const counts = new Map<string, number>();
      for (const m of moodLogs) if (m.user_id === uid) counts.set(m.mood, (counts.get(m.mood) ?? 0) + 1);
      return [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
    };
    const myMood = topMood(user?.id) ?? moods[0] ?? null;
    const theirMood = topMood(partner?.id);
    {
      list.push({
        key: 'mood',
        colors: ['#C4E9F3', '#A9EADD'],
        body: (
          <>
            <Eyebrow>How you felt this year</Eyebrow>
            <Title small>{moodLogs.length > 0 ? `${moodLogs.length} moods shared` : 'Your moods'}</Title>
            <Animated.View entering={FadeInDown.delay(220).duration(420)} style={styles.moodPair}>
              {[
                { who: 'You', mood: myMood },
                { who: them, mood: theirMood },
              ].map((p) => (
                <View key={p.who} style={styles.moodCard}>
                  <Text style={styles.moodEmoji}>{p.mood ? (MOOD_EMOJI[p.mood] ?? '✨') : '·'}</Text>
                  <Text style={styles.moodWho}>{p.who}</Text>
                  <Text style={styles.moodName}>{p.mood ? (MOOD_LABELS[p.mood] ?? p.mood) : 'No moods yet'}</Text>
                </View>
              ))}
            </Animated.View>
          </>
        ),
      });
    }

    // ── A question you both answered
    const answered = (yearQuestions ?? questions).filter(
      (q) => isPromptComplete(q) && new Date(q.challenge_date) >= yearStart,
    );
    const pick = answered.find(
      (q) => myPromptResponse(q, user?.id, relationship) && partnerPromptResponse(q, user?.id, relationship),
    );
    if (pick) {
      list.push({
        key: 'question',
        colors: ['#C6CFF1', '#A9EAAB'],
        body: (
          <>
            <IconBadge icon="question" />
            <Eyebrow>
              {answered.length} question{answered.length === 1 ? '' : 's'} answered together this year
            </Eyebrow>
            <Title small>“{pick.prompt}”</Title>
            <Animated.View entering={FadeInDown.delay(260).duration(420)} style={styles.answers}>
              <Answer who="You" text={myPromptResponse(pick, user?.id, relationship) ?? ''} />
              <Answer who={them} text={partnerPromptResponse(pick, user?.id, relationship) ?? ''} />
            </Animated.View>
          </>
        ),
      });
    } else {
      list.push({
        key: 'question',
        colors: ['#C6CFF1', '#A9EAAB'],
        body: (
          <>
            <IconBadge icon="question" />
            <Eyebrow>Daily questions answered together</Eyebrow>
            <Big>{answered.length}</Big>
            <Body>{answered.length > 0 ? 'One honest answer at a time.' : 'Answer Today’s Question together.'}</Body>
          </>
        ),
      });
    }

    // ── Memories
    const yearMemories = memories.filter((m) => new Date(m.date_time) >= yearStart);
    {
      const latest = [...yearMemories].sort((a, b) => +new Date(b.date_time) - +new Date(a.date_time))[0];
      list.push({
        key: 'memories',
        colors: ['#EFC6F1', '#CBA9EA'],
        body: (
          <>
            <IconBadge icon="albums" />
            <Eyebrow>Memories saved</Eyebrow>
            <Big>{yearMemories.length}</Big>
            <Body>
              {latest
                ? `Most recently “${latest.title}”, ${format(new Date(latest.date_time), 'd MMMM')}.`
                : 'Save your first one on Plan.'}
            </Body>
            <StatRows
              rows={MEMORY_TYPES.map((t) => ({
                icon: t.icon,
                label: t.label,
                n: yearMemories.filter((m) => (parsePlanMeta(m.description).memoryType ?? 'justus') === t.key).length,
              }))
                .sort((a, b) => b.n - a.n)
                .slice(0, 3)}
            />
          </>
        ),
      });
    }

    // ── Plans made
    {
      const kindCounts = new Map<string, number>();
      for (const p of plans) {
        const k = parsePlanMeta(p.description).kind ?? 'other';
        kindCounts.set(k, (kindCounts.get(k) ?? 0) + 1);
      }
      const topKind = [...kindCounts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
      const kind = PLAN_KIND_OPTIONS.find((k) => k.key === topKind);
      const done = plans.filter((p) => isPlanCompleted(p, now)).length;
      list.push({
        key: 'plans',
        colors: ['#C0F7F2', '#9FF4ED'],
        body: (
          <>
            <IconBadge icon="calendar" />
            <Eyebrow>Plans you made</Eyebrow>
            <Big>{plans.length}</Big>
            <Body>
              {kind
                ? `Mostly ${kind.label.toLowerCase()} plans. You two know how to have a good time.`
                : plans.length > 0
                  ? 'Time well spent, together.'
                  : 'Your first date night is waiting.'}
            </Body>
            <StatRows
              rows={[
                { icon: 'check', label: 'Done together', n: done },
                { icon: 'flag', label: 'Kinds of plans', n: kindCounts.size },
              ]}
            />
          </>
        ),
      });
    }

    // ── Play: level, XP and games
    const progress = playProgress ?? emptyProgress(todayKey());
    const games = progress.stats.games_played ?? 0;
    {
      const info = levelInfo(progress.xp);
      list.push({
        key: 'play',
        colors: ['#C4B8FF', '#D094FF'],
        body: (
          <>
            <IconBadge icon="gamepad" />
            <Eyebrow>Game nights</Eyebrow>
            <Title>
              Level {info.level} · {info.title}
            </Title>
            <StatRows
              rows={[
                { icon: 'star', label: 'XP earned', n: progress.xp },
                { icon: 'dice', label: 'Games played', n: games },
                { icon: 'volumeHigh', label: 'Live rooms', n: progress.stats.live_games ?? 0 },
                { icon: 'sparkles', label: 'In sync', n: progress.stats.sync_matches ?? 0 },
              ]}
            />
          </>
        ),
      });
    }

    // ── Game highlights: the small wins inside those games
    const highlights = (
      [
        { icon: 'chat', label: 'Truths told', n: progress.stats.truths_done ?? 0 },
        { icon: 'fire', label: 'Dares done', n: progress.stats.dares_done ?? 0 },
        { icon: 'target', label: 'Quiz answers right', n: progress.stats.quiz_correct ?? 0 },
        { icon: 'eye', label: 'Answers guessed', n: progress.stats.guesses_correct ?? 0 },
        { icon: 'sparkles', label: 'Activities done', n: progress.stats.solo_games ?? 0 },
        { icon: 'calendar', label: 'Best play streak', n: progress.bestStreak },
      ] satisfies StatRow[]
    ).filter((h) => h.n > 0);
    if (highlights.length >= 1) {
      list.push({
        key: 'highlights',
        colors: ['#CFB8FF', '#CCA1F2'],
        body: (
          <>
            <IconBadge icon="target" />
            <Eyebrow>Game highlights</Eyebrow>
            <Title small>The little wins</Title>
            <StatRows rows={highlights.sort((a, b) => b.n - a.n).slice(0, 4)} />
          </>
        ),
      });
    }

    // ── Badges unlocked
    const earned = BADGES.filter((b) => progress.badges.includes(b.id));
    {
      list.push({
        key: 'badges',
        colors: ['#F9DFBD', '#F9C29A'],
        body: (
          <>
            <IconBadge icon="star" />
            <Eyebrow>Badges unlocked</Eyebrow>
            <Big>{earned.length}</Big>
            <Body>
              of {BADGES.length}.{' '}
              {earned.length === BADGES.length
                ? 'Every single one.'
                : earned.length > 0
                  ? 'More waiting next year.'
                  : 'Play together to unlock your first.'}
            </Body>
            <Animated.View entering={FadeInDown.delay(260).duration(420)} style={styles.badgeGrid}>
              {earned.slice(0, 6).map((b) => (
                <View key={b.id} style={styles.badgeChip}>
                  <Icon name={b.icon} size={16} color={INK} />
                  <Text style={styles.badgeChipText} numberOfLines={1}>
                    {b.title}
                  </Text>
                </View>
              ))}
            </Animated.View>
          </>
        ),
      });
    }

    // ── Your couple type
    const night = total
      ? stats.filter((m) => {
          const h = new Date(m.created_at).getHours();
          return h >= 20 || h < 5;
        }).length / total
      : 0;
    const morning = total
      ? stats.filter((m) => {
          const h = new Date(m.created_at).getHours();
          return h >= 5 && h < 11;
        }).length / total
      : 0;
    // First match wins, most remarkable first.
    const memoriesThisYear = memories.filter((m) => new Date(m.date_time) >= yearStart).length;
    // The first rule that fits wins, most remarkable first; `why` shows on the card.
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    const TYPES: (CoupleType & { fits: boolean })[] = [
      {
        fits: longest >= 30,
        icon: 'flash',
        name: 'The Unstoppables',
        line: 'Nothing gets between you two.',
        why: `A ${longest} day streak`,
      },
      {
        fits: total >= 150,
        icon: 'film',
        name: 'The Storytellers',
        line: 'If it happened, the other one saw it.',
        why: `${total} moments shared`,
      },
      {
        fits: games >= 20,
        icon: 'dice',
        name: 'The Game Night Duo',
        line: 'Competitive, a little chaotic, always together.',
        why: `${games} games played`,
      },
      {
        fits: night > 0.45,
        icon: 'moon',
        name: 'The Night Owls',
        line: 'Late-night moments are your love language.',
        why: `${pct(night)} of your moments after 8 pm`,
      },
      {
        fits: morning > 0.4,
        icon: 'sunny',
        name: 'The Early Birds',
        line: 'You start every day with each other.',
        why: `${pct(morning)} of your moments before 11 am`,
      },
      {
        fits: answered.length >= 20,
        icon: 'chat',
        name: 'The Deep Talkers',
        line: 'Big questions, honest answers, every day.',
        why: `${answered.length} questions answered together`,
      },
      {
        fits: plans.length >= 25,
        icon: 'map',
        name: 'The Planners',
        line: 'Always something on the calendar together.',
        why: `${plans.length} plans made`,
      },
      {
        fits: memoriesThisYear >= 15,
        icon: 'journal',
        name: 'The Memory Keepers',
        line: 'You never let a good day slip away.',
        why: `${memoriesThisYear} memories saved`,
      },
      {
        fits: myMood === 'loved' || myMood === 'happy',
        icon: 'sparkles',
        name: 'The Sunshine Pair',
        line: 'Good moods, good company, good year.',
        why: 'Your most shared mood was a happy one',
      },
      {
        fits: true,
        icon: 'heart',
        name: 'The Sweethearts',
        line: 'Steady, sweet, and always checking in.',
        why: 'Showing up for each other, all year',
      },
    ];
    const { fits: _fits, ...type } = TYPES.find((t) => t.fits)!;
    list.push({
      key: 'type',
      colors: ['#F3C3C8', '#EAA9D7'],
      body: (
        <>
          <Eyebrow>Your couple type</Eyebrow>
          <Animated.View entering={FadeIn.delay(80).duration(500)} style={styles.badge}>
            <Icon name={type.icon} size={88} color={INK} filled />
          </Animated.View>
          <Title>{type.name}</Title>
          <Body>{type.line}</Body>
          <Animated.View entering={FadeInDown.delay(300).duration(420)} style={styles.whyPill}>
            <Icon name="info" size={15} color={INK} />
            <Text style={styles.whyText}>{type.why}</Text>
          </Animated.View>
        </>
      ),
    });

    // ── Outro
    coupleType = type;
    const summary = `${days} days together · ${total} moments · ${longest} day best streak · ${type.name}`;
    list.push({
      key: 'outro',
      colors: ['#F1C6CE', '#EAA9DA'],
      body: (
        <>
          <Eyebrow>That’s a wrap</Eyebrow>
          <Title>
            Here’s to more{'\n'}moments, {me} & {them}.
          </Title>
          <Body>{summary}</Body>
        </>
      ),
    });

    return { slides: list, coupleType };
  }, [
    relationship,
    year,
    yearStart,
    now,
    me,
    them,
    yearMoments,
    user?.id,
    partner?.id,
    momentsData,
    streak,
    moods,
    memories,
    questions,
    yearQuestions,
    moodLogs,
    plans,
    playProgress,
  ]);

  const [index, setIndex] = useState(0);
  const [sharing, setSharing] = useState(false);
  /** The full-size story inside the share preview: captured at full resolution. */
  const storyShotRef = useRef<View>(null);

  /**
   * Share what's on screen: each story becomes a story-shaped image (9:16,
   * ready for Instagram / WhatsApp status). The last story shares the year
   * summary card instead.
   */
  const shareCard = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSharing(true);
  };
  // The year in four numbers, for the share card.
  const shareStats = useMemo<WrappedStat[]>(() => {
    const together = relationship ? getRelationshipAnniversaryDate(relationship) : yearStart;
    const from = together > yearStart ? together : yearStart;
    return [
      { icon: 'heart', value: Math.max(1, differenceInCalendarDays(now, from) + 1), label: 'Days together' },
      { icon: 'camera', value: (yearMoments as MomentStat[]).length, label: 'Moments' },
      { icon: 'fire', value: Math.max(streak?.longest_streak ?? 0, streak?.current_streak ?? 0), label: 'Best streak' },
      { icon: 'calendar', value: plans.length, label: 'Plans' },
      { icon: 'albums', value: memories.filter((m) => new Date(m.date_time) >= yearStart).length, label: 'Memories' },
      { icon: 'gamepad', value: playProgress?.stats.games_played ?? 0, label: 'Games' },
    ];
  }, [relationship, yearStart, now, yearMoments, streak, plans, memories, playProgress]);
  const slide = slides[Math.min(index, slides.length - 1)];
  const go = (delta: number) => {
    const next = Math.max(0, Math.min(slides.length - 1, index + delta));
    if (next === index) return;
    void Haptics.selectionAsync();
    setIndex(next);
  };

  // Swipe down to close.
  const dragY = useSharedValue(0);
  const slideAway = () => {
    dragY.value = withTiming(SCREEN_H, { duration: 200 }, (done) => {
      if (done) runOnJS(onClose)();
    });
  };
  const pan = Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetX([-16, 16])
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 800) runOnJS(slideAway)();
      else dragY.value = withSpring(0, { damping: 24, stiffness: 260 });
    });
  const pageStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
    borderRadius: dragY.value > 0 ? 28 : 0,
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, dragY.value / SCREEN_H) }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <StatusBar style="dark" />
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <GestureDetector gesture={pan}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.page, pageStyle]}>
          {/* The story itself. Share draws it again as a 9:16 card in the preview. */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <LinearGradient
              colors={slide.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, styles.scrim]} />
            <Animated.View
              key={slide.key}
              entering={FadeIn.duration(260)}
              style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 96 }]}>
              <FitBody>{slide.body}</FitBody>
            </Animated.View>
          </View>

          {/* Tap zones: left third goes back, the rest goes forward. */}
          <View style={StyleSheet.absoluteFill}>
            <Pressable style={styles.tapBack} onPress={() => go(-1)} accessibilityLabel="Previous" />
            <Pressable style={styles.tapNext} onPress={() => go(1)} accessibilityLabel="Next" />
          </View>

          <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <View style={styles.bars}>
              {slides.map((s, i) => (
                <View key={s.key} style={styles.bar}>
                  <View style={[styles.barFill, { width: i <= index ? '100%' : '0%' }]} />
                </View>
              ))}
            </View>
            <View style={styles.topRow} pointerEvents="box-none">
              <Text style={styles.topLabel}>Wrapped {year}</Text>
              <Pressable
                onPress={slideAway}
                hitSlop={12}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close">
                <Icon name="close" size={24} color={INK} />
              </Pressable>
            </View>
          </View>

          {/* Share this card as an image; on the last card, Done too. */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
            <Pressable
              onPress={shareCard}
              accessibilityRole="button"
              accessibilityLabel={slide.key === 'outro' ? 'Share our year' : 'Share this story'}
              style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}>
              <Icon name="share" size={18} color={PAPER} />
              <Text style={styles.shareText}>{slide.key === 'outro' ? 'Share our year' : 'Share'}</Text>
            </Pressable>
            {slide.key === 'outro' ? (
              <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8} style={styles.doneBtn}>
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>

      <ShareCardModal
        visible={sharing}
        onClose={() => setSharing(false)}
        title={`Our ${year} Wrapped`}
        inline
        captureFrom={slide.key === 'outro' ? undefined : storyShotRef}>
        {slide.key === 'outro' ? (
          <WrappedShareCard
            year={year}
            names={`${me} & ${them}`}
            stats={shareStats}
            coupleType={{ icon: coupleType.icon, name: coupleType.name }}
            colors={slide.colors}
          />
        ) : (
          <StoryShareCard slide={slide} year={year} shotRef={storyShotRef} />
        )}
      </ShareCardModal>
    </View>
  );
}

type CoupleType = { icon: IconName; name: string; line: string; why: string };

/**
 * One story as a shareable image: the full screen story drawn at its real size, then scaled
 * down into the same short 4:5 card as the summary; anything too tall shrinks to fit.
 */
function StoryShareCard({ slide, year, shotRef }: { slide: Slide; year: number; shotRef: RefObject<View | null> }) {
  const { width: W, height: H } = useWindowDimensions();
  // Same 4:5 shape as the summary, as large as the preview allows (room is left for the buttons),
  // so the saved image is big and sharp.
  const cardW = Math.min(W - 48, ((H - 300) * SHARE_CARD_W) / SHARE_CARD_H);
  const cardH = (cardW * SHARE_CARD_H) / SHARE_CARD_W;
  const k = cardW / W;
  const innerH = cardH / k;
  return (
    <LayoutAnimationConfig skipEntering>
      <View style={[styles.storyClip, { width: cardW, height: cardH }]}>
        {/* Drawn full size (that's what's captured, sharp), shrunk only to fit the preview. */}
        <View
          ref={shotRef}
          collapsable={false}
          style={{
            width: W,
            height: innerH,
            transformOrigin: 'top left',
            transform: [{ scale: k }],
            overflow: 'hidden',
            borderRadius: 24 / k,
            borderWidth: 3 / k,
            borderColor: INK,
          }}>
          <LinearGradient
            colors={slide.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, styles.scrim]} />
          <Text style={styles.storyTop}>Our {year} Wrapped</Text>
          <View style={[styles.content, { paddingTop: 84, paddingBottom: 100 }]}>
            <FitBody>{slide.body}</FitBody>
          </View>
          <View style={styles.storyFoot}>
            <ShareBrand size="lg" style={styles.storyBrand} />
          </View>
        </View>
      </View>
    </LayoutAnimationConfig>
  );
}
type StatRow = { icon: IconName; label: string; n: number };

/** Keeps a story on screen: when its content is taller than the space, it scales down to fit. */
function FitBody({ children }: { children: ReactNode }) {
  const [box, setBox] = useState(0);
  const [inner, setInner] = useState(0);
  const k = box > 0 && inner > box ? box / inner : 1;
  return (
    <View style={styles.fitBox} onLayout={(e) => setBox(e.nativeEvent.layout.height)}>
      <View
        style={[styles.fitInner, { transform: [{ scale: k }] }]}
        onLayout={(e) => setInner(e.nativeEvent.layout.height)}>
        {children}
      </View>
    </View>
  );
}

/** Icon · label · count rows; rows at zero are left out. */
function StatRows({ rows }: { rows: StatRow[] }) {
  const shown = rows.filter((r) => r.n > 0);
  if (shown.length === 0) return null;
  return (
    <View style={styles.typeList}>
      {shown.map((t, i) => (
        <Animated.View key={t.label} entering={FadeInDown.delay(200 + i * 100).duration(420)} style={styles.typeRow}>
          <View style={styles.typeIcon}>
            <Icon name={t.icon} size={22} color={INK} />
          </View>
          <Text style={styles.typeLabel}>{t.label}</Text>
          <Text style={styles.typeCount}>{t.n.toLocaleString()}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

/** A round icon above a card's heading. */
function IconBadge({ icon }: { icon: IconName }) {
  return (
    <Animated.View entering={FadeIn.duration(450)} style={styles.iconBadge}>
      <Icon name={icon} size={34} color={INK} />
    </Animated.View>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Animated.Text entering={FadeInDown.duration(380)} style={styles.eyebrow}>
      {children}
    </Animated.Text>
  );
}

function Big({ children }: { children: ReactNode }) {
  return (
    <Animated.Text
      entering={FadeInDown.delay(90).duration(420)}
      style={styles.big}
      adjustsFontSizeToFit
      numberOfLines={1}>
      {children}
    </Animated.Text>
  );
}

function Title({ children, small }: { children: ReactNode; small?: boolean }) {
  return (
    <Animated.Text entering={FadeInDown.delay(160).duration(420)} style={[styles.title, small && styles.titleSmall]}>
      {children}
    </Animated.Text>
  );
}

function Body({ children }: { children: ReactNode }) {
  return (
    <Animated.Text entering={FadeInDown.delay(230).duration(420)} style={styles.body}>
      {children}
    </Animated.Text>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <Animated.Text entering={FadeIn.delay(700).duration(500)} style={styles.hint}>
      {children}
    </Animated.Text>
  );
}

function SplitBar({
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  left: number;
  right: number;
  leftLabel: string;
  rightLabel: string;
}) {
  const total = Math.max(1, left + right);
  return (
    <Animated.View entering={FadeInDown.delay(300).duration(420)} style={styles.split}>
      <View style={styles.splitTrack}>
        <View style={[styles.splitLeft, { flex: Math.max(left, 0.0001) / total }]} />
        <View style={{ flex: Math.max(right, 0.0001) / total }} />
      </View>
      <View style={styles.splitLabels}>
        <Text style={styles.splitText}>
          {leftLabel} · {left}
        </Text>
        <Text style={styles.splitText}>
          {rightLabel} · {right}
        </Text>
      </View>
    </Animated.View>
  );
}

/** A small bar chart; the highlighted bar is solid, the rest faint. */
function Bars({ values, labels, highlight }: { values: number[]; labels: string[]; highlight: number }) {
  const max = Math.max(1, ...values);
  return (
    <View style={styles.chart}>
      {values.map((v, i) => (
        <Animated.View key={i} entering={FadeInUp.delay(260 + i * 45).duration(380)} style={styles.chartCol}>
          <View style={styles.chartTrack}>
            <View
              style={[
                styles.chartBar,
                { height: `${Math.max(6, (v / max) * 100)}%`, backgroundColor: i === highlight ? INK : FAINT },
              ]}
            />
          </View>
          <Text style={[styles.chartLabel, i === highlight && styles.chartLabelOn]}>{labels[i]}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

function Answer({ who, text }: { who: string; text: string }) {
  return (
    <View style={styles.answer}>
      <Text style={styles.answerWho}>{who}</Text>
      <Text style={styles.answerText} numberOfLines={4}>
        {text}
      </Text>
    </View>
  );
}

const CONTENT_W = Math.min(SCREEN_W - 56, 360);

const styles = StyleSheet.create({
  whyPill: {
    marginTop: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: PAPER,
    borderWidth: 2,
    borderColor: INK,
  },
  whyText: { color: SOFT, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  // Matches the summary card's top row (drawn at phone size, then scaled down with the story).
  storyTop: {
    position: 'absolute',
    left: 28,
    right: 28,
    top: 34,
    textAlign: 'center',
    color: INK,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  storyFoot: { position: 'absolute', left: 0, right: 0, bottom: 34, alignItems: 'center' },
  storyBrand: { alignSelf: 'center' },
  scrim: { backgroundColor: 'transparent' },
  storyClip: { overflow: 'hidden', borderRadius: 24 },
  fitBox: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  fitInner: { width: '100%', alignItems: 'center', gap: 12 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  page: { overflow: 'hidden' },
  tapBack: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '33%' },
  tapNext: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '67%' },
  top: { paddingHorizontal: 12, gap: 10 },
  bars: { flexDirection: 'row', gap: 3 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: FAINT, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: INK },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  topLabel: { color: INK, fontSize: 15, fontWeight: '800' },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: -8 },

  // Every card: one centred column, the same width, the same rhythm.
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  eyebrow: { color: SOFT, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  big: { color: INK, fontSize: 108, fontWeight: '900', letterSpacing: -4, lineHeight: 114, textAlign: 'center' },
  title: { color: INK, fontSize: 34, fontWeight: '900', letterSpacing: -0.8, lineHeight: 40, textAlign: 'center' },
  titleSmall: { fontSize: 26, lineHeight: 32 },
  body: { color: SOFT, fontSize: 18, fontWeight: '600', lineHeight: 25, textAlign: 'center', maxWidth: CONTENT_W },
  hint: { color: 'rgba(0,0,0,0.5)', fontSize: 14, fontWeight: '700', marginTop: 28 },

  split: { width: CONTENT_W, gap: 8, marginTop: 8 },
  splitTrack: {
    height: 16,
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: PAPER,
    borderWidth: 2,
    borderColor: INK,
  },
  splitLeft: { backgroundColor: INK },
  splitLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  splitText: { color: INK, fontSize: 15, fontWeight: '800' },

  collage: {
    width: CONTENT_W,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  collageTile: {
    width: 100,
    height: 128,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: INK,
    overflow: 'hidden',
    backgroundColor: PAPER,
  },

  chart: { width: CONTENT_W, height: 150, flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 18 },
  chartCol: { flex: 1, height: '100%', alignItems: 'center', gap: 6 },
  chartTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  chartBar: { width: '100%', borderRadius: 6, borderWidth: 2, borderColor: INK },
  chartLabel: { color: SOFT, fontSize: 12, fontWeight: '700' },
  chartLabelOn: { color: INK, fontWeight: '900' },

  typeList: { width: CONTENT_W, gap: 10, marginTop: 8 },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    height: 64,
    borderRadius: 20,
    backgroundColor: PAPER,
    borderWidth: 2,
    borderColor: INK,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFE7A0',
    borderWidth: 2,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: { flex: 1, color: INK, fontSize: 17, fontWeight: '700' },
  typeCount: { color: INK, fontSize: 24, fontWeight: '900' },

  answers: { width: CONTENT_W, gap: 10, marginTop: 8 },
  answer: { borderRadius: 18, padding: 14, gap: 4, backgroundColor: PAPER, borderWidth: 2, borderColor: INK },
  answerWho: { color: SOFT, fontSize: 13, fontWeight: '800' },
  answerText: { color: INK, fontSize: 16, fontWeight: '600', lineHeight: 22 },

  badge: {
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: '#FFE7A0',
    borderWidth: 3,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PAPER,
    borderWidth: 2,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  moodPair: { flexDirection: 'row', gap: 12, width: CONTENT_W, marginTop: 8 },
  moodCard: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 4,
    backgroundColor: PAPER,
    borderWidth: 2,
    borderColor: INK,
  },
  moodEmoji: { fontSize: 56, lineHeight: 66 },
  moodWho: { color: SOFT, fontSize: 13, fontWeight: '800' },
  moodName: { color: INK, fontSize: 18, fontWeight: '900' },
  badgeGrid: {
    width: CONTENT_W,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    backgroundColor: PAPER,
    borderWidth: 2,
    borderColor: INK,
  },
  badgeChipText: { color: INK, fontSize: 14, fontWeight: '800', maxWidth: 120 },
  shareBtn: {
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareText: { color: PAPER, fontSize: 16, fontWeight: '900' },
  doneBtn: { height: 40, justifyContent: 'center', paddingHorizontal: 8 },
  doneText: { color: INK, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.85 },
});
