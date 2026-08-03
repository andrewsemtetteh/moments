import type { ExploreModalKey } from '@/components/activities/ExploreSection';

import {
  ComplimentJarScreen,
  MemoryQuizScreen,
  PlaylistForTwoScreen,
  TruthOrDareScreen,
  TwoTruthsScreen,
} from './explore-extra-screens';
import {
  AppreciationScreen,
  AttachmentScreen,
  ChoiceRoundsScreen,
  CompatibilityScreen,
  DateGeneratorScreen,
  DateNightChallengeScreen,
  DrawTogetherScreen,
  EmojiStoryScreen,
  FinishSentenceScreen,
  FortuneWheelScreen,
  GuessAnswerScreen,
  LoveQuizScreen,
  NeverHaveIScreen,
  PersonalityScreen,
  ThirtySixScreen,
  WeekChallengeScreen,
  WhosLikelyScreen,
} from './explore-play-screens';
import { QuizLiveScreen } from './QuizLiveScreen';
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
  onAddToCalendar: (title: string) => void;
}

export function ExploreActivityModal({ activeModal, onClose }: ExploreActivityModalProps) {
  if (!activeModal) return null;

  const meta = EXPLORE_META[activeModal];
  if (!meta) return null;

  return (
    <ExploreModalShell visible meta={meta} onClose={onClose}>
      {activeModal === 'cards' && <CardsDeckScreen />}
      {activeModal === 'games' && <GamesPlayerScreen />}
      {activeModal === 'quiz' && <QuizScreen />}
      {activeModal === 'quizLive' && <QuizLiveScreen />}
      {activeModal === 'bucket' && <BucketListScreen />}
      {activeModal === 'goals' && <GoalsScreen />}
      {activeModal === 'gratitude' && <GratitudeSwapScreen />}
      {activeModal === 'daily' && <QuestionOfDayScreen />}
      {activeModal === 'trivia' && <CouplesTriviaScreen />}
      {activeModal === 'compliment' && <ComplimentJarScreen />}
      {activeModal === 'twoTruths' && <TwoTruthsScreen />}
      {activeModal === 'truth' && <TruthOrDareScreen />}
      {activeModal === 'memory' && <MemoryQuizScreen />}
      {activeModal === 'playlist' && <PlaylistForTwoScreen />}
      {activeModal === 'thisOrThat' && <ChoiceRoundsScreen gameName="This or That" />}
      {activeModal === 'wouldYouRather' && <ChoiceRoundsScreen gameName="Would You Rather" />}
      {activeModal === 'whosLikely' && <WhosLikelyScreen />}
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
      {activeModal === 'guessAnswer' && <GuessAnswerScreen />}
    </ExploreModalShell>
  );
}
