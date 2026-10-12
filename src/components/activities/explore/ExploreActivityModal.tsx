import { useEffect } from 'react';

import type { ExploreModalKey } from '@/components/activities/explore/explore-catalog';
import { useRelationshipStore } from '@/stores';
import { usePlayProgressStore } from '@/stores/play-progress-store';

import {
  ComplimentJarScreen,
  MemoryQuizScreen,
  PlaylistForTwoScreen,
} from './explore-extra-screens';
import {
  AppreciationScreen,
  AttachmentScreen,
  CompatibilityScreen,
  DateGeneratorScreen,
  DateNightChallengeScreen,
  DrawTogetherScreen,
  EmojiStoryScreen,
  FinishSentenceScreen,
  FortuneWheelScreen,
  LoveQuizScreen,
  NeverHaveIScreen,
  PersonalityScreen,
  ThirtySixScreen,
  WeekChallengeScreen,
} from './explore-play-screens';
import { SOLO_XP } from './explore-catalog';
import { EXPLORE_META } from './explore-meta';
import { ExploreModalShell } from './ExploreModalShell';
import {
  BucketListScreen,
  CardsDeckScreen,
  CouplesTriviaScreen,
  GamesPlayerScreen,
  GoalsScreen,
  GratitudeSwapScreen,
  QuestionOfDayScreen,
  QuizScreen,
} from './explore-screens';

interface ExploreActivityModalProps {
  activeModal: ExploreModalKey | null;
  onClose: () => void;
}

/** How long an activity has to stay open before it counts as "played" (stops tap-and-close XP farming). */
const PLAYED_AFTER_MS = 25_000;

export function ExploreActivityModal({ activeModal, onClose }: ExploreActivityModalProps) {
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);

  useEffect(() => {
    if (!activeModal || !relationshipId) return;
    const timer = setTimeout(() => {
      void usePlayProgressStore.getState().award(
        relationshipId,
        { xp: SOLO_XP, stats: { games_played: 1, solo_games: 1 }, events: { game_played: 1 }, soloId: activeModal },
        EXPLORE_META[activeModal]?.title ?? 'Played together',
      );
    }, PLAYED_AFTER_MS);
    return () => clearTimeout(timer);
  }, [activeModal, relationshipId]);

  if (!activeModal) return null;

  const meta = EXPLORE_META[activeModal];
  if (!meta) return null;

  return (
    <ExploreModalShell visible meta={meta} onClose={onClose}>
      {activeModal === 'cards' && <CardsDeckScreen />}
      {activeModal === 'games' && <GamesPlayerScreen />}
      {activeModal === 'quiz' && <QuizScreen />}
      {activeModal === 'bucket' && <BucketListScreen />}
      {activeModal === 'goals' && <GoalsScreen />}
      {activeModal === 'gratitude' && <GratitudeSwapScreen />}
      {activeModal === 'daily' && <QuestionOfDayScreen />}
      {activeModal === 'trivia' && <CouplesTriviaScreen />}
      {activeModal === 'compliment' && <ComplimentJarScreen />}
      {activeModal === 'memory' && <MemoryQuizScreen />}
      {activeModal === 'playlist' && <PlaylistForTwoScreen />}
      {activeModal === 'loveQuiz' && <LoveQuizScreen />}
      {activeModal === 'neverHaveI' && <NeverHaveIScreen />}
      {activeModal === 'finishSentence' && <FinishSentenceScreen />}
      {activeModal === 'emojiStory' && <EmojiStoryScreen />}
      {activeModal === 'appreciation' && <AppreciationScreen />}
      {activeModal === 'thirtySix' && <ThirtySixScreen />}
      {activeModal === 'weekChallenge' && <WeekChallengeScreen />}
      {activeModal === 'dateNight' && <DateNightChallengeScreen />}
      {activeModal === 'fortuneWheel' && <FortuneWheelScreen />}
      {activeModal === 'dateGenerator' && <DateGeneratorScreen />}
      {activeModal === 'drawTogether' && <DrawTogetherScreen />}
      {activeModal === 'compatibility' && <CompatibilityScreen />}
      {activeModal === 'personality' && <PersonalityScreen />}
      {activeModal === 'attachment' && <AttachmentScreen />}
    </ExploreModalShell>
  );
}
