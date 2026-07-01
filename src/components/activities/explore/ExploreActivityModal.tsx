import type { ExploreModalKey } from '@/components/activities/ExploreSection';

import {
  ComplimentJarScreen,
  MemoryQuizScreen,
  PlaylistForTwoScreen,
  TruthOrDareScreen,
  TwoTruthsScreen,
} from './explore-extra-screens';
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
    </ExploreModalShell>
  );
}
