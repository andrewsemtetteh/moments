import type { IconName } from '@/components/ui/Icon';
import type { ExploreModalKey } from '@/components/activities/ExploreSection';

export interface ExploreMeta {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: IconName;
  emoji: string;
}

export const EXPLORE_META: Record<ExploreModalKey, ExploreMeta> = {
  cards: {
    eyebrow: 'CONNECT',
    title: 'Conversation Cards',
    subtitle: 'Take turns answering — no wrong answers',
    icon: 'cards',
    emoji: '💬',
  },
  games: {
    eyebrow: 'PLAY',
    title: 'Mini Games',
    subtitle: 'Quick rounds for laughs and surprises',
    icon: 'gamepad',
    emoji: '🎲',
  },
  quiz: {
    eyebrow: 'DISCOVER',
    title: 'Love Language',
    subtitle: 'Learn how you each feel most loved',
    icon: 'heart',
    emoji: '💞',
  },
  quizLive: {
    eyebrow: 'PLAY LIVE',
    title: 'Quiz Live',
    subtitle: 'Pick a topic and compete together from your phones',
    icon: 'globe',
    emoji: '🌐',
  },
  bucket: {
    eyebrow: 'DREAM',
    title: 'Bucket List',
    subtitle: 'Collect adventures you want to share',
    icon: 'list',
    emoji: '✈️',
  },
  goals: {
    eyebrow: 'TOGETHER',
    title: 'Shared Goals',
    subtitle: 'Build something as a team',
    icon: 'target',
    emoji: '🎯',
  },
  gratitude: {
    eyebrow: 'TODAY',
    title: 'Gratitude Swap',
    subtitle: 'Three things you appreciated about your partner',
    icon: 'heart',
    emoji: '🙏',
  },
  daily: {
    eyebrow: 'TODAY',
    title: 'Question of the Day',
    subtitle: 'One light prompt — answer together',
    icon: 'journal',
    emoji: '💭',
  },
  trivia: {
    eyebrow: 'PLAY',
    title: 'Couples Trivia',
    subtitle: 'Quick rounds on love, connection & us',
    icon: 'star',
    emoji: '🧠',
  },
  compliment: {
    eyebrow: 'LOVE',
    title: 'Compliment Jar',
    subtitle: 'Drop notes your partner can draw anytime',
    icon: 'gift',
    emoji: '💝',
  },
  twoTruths: {
    eyebrow: 'PLAY',
    title: 'Two Truths & a Lie',
    subtitle: 'Write three statements — one fib',
    icon: 'eye',
    emoji: '🃏',
  },
  truth: {
    eyebrow: 'PLAY',
    title: 'Truth or Dare',
    subtitle: 'Couples-safe truths and dares',
    icon: 'fire',
    emoji: '🔥',
  },
  memory: {
    eyebrow: 'REMEMBER',
    title: 'Memory Quiz',
    subtitle: 'Compare answers about your story',
    icon: 'journal',
    emoji: '🧩',
  },
  playlist: {
    eyebrow: 'MUSIC',
    title: 'Playlist for Two',
    subtitle: 'Pick a song that fits the prompt',
    icon: 'volumeHigh',
    emoji: '🎵',
  },
};
