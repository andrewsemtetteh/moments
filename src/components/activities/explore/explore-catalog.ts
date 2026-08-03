import type { ActivityArtId } from '@/components/activities/explore/ActivityArt';
import type { IconName } from '@/components/ui/Icon';

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
  | 'playlist'
  | 'thisOrThat'
  | 'wouldYouRather'
  | 'whosLikely'
  | 'loveQuiz'
  | 'neverHaveI'
  | 'finishSentence'
  | 'emojiStory'
  | 'appreciation'
  | 'thirtySix'
  | 'weekChallenge'
  | 'dateNight'
  | 'fortuneWheel'
  | 'dateGenerator'
  | 'drawTogether'
  | 'compatibility'
  | 'personality'
  | 'attachment'
  | 'guessAnswer';

export type PlayGroupId = 'play' | 'quizzes' | 'talk' | 'challenges' | 'create';

export type HomeFilterId = 'all' | PlayGroupId;

/** Soft card palette — unique per activity so the feed doesn’t feel monotone. */
export type PlayToneId =
  | 'rose'
  | 'coral'
  | 'amber'
  | 'sage'
  | 'sky'
  | 'plum'
  | 'cocoa'
  | 'teal'
  | 'berry'
  | 'slate';

export interface PlayTone {
  accent: string;
  soft: string;
  wash: [string, string];
  darkWash: [string, string];
}

export const PLAY_TONES: Record<PlayToneId, PlayTone> = {
  rose: {
    accent: '#E5577A',
    soft: 'rgba(229,87,122,0.14)',
    wash: ['#FFF9FB', '#FFE4EC'],
    darkWash: ['rgba(229,87,122,0.08)', 'rgba(229,87,122,0.22)'],
  },
  coral: {
    accent: '#E07A5F',
    soft: 'rgba(224,122,95,0.16)',
    wash: ['#FFF9F6', '#FFE6DC'],
    darkWash: ['rgba(224,122,95,0.08)', 'rgba(224,122,95,0.24)'],
  },
  amber: {
    accent: '#C9922A',
    soft: 'rgba(201,146,42,0.16)',
    wash: ['#FFFCF5', '#FFF0D2'],
    darkWash: ['rgba(201,146,42,0.08)', 'rgba(201,146,42,0.22)'],
  },
  sage: {
    accent: '#4F8A6E',
    soft: 'rgba(79,138,110,0.16)',
    wash: ['#F7FBF8', '#DFF0E6'],
    darkWash: ['rgba(79,138,110,0.08)', 'rgba(79,138,110,0.22)'],
  },
  sky: {
    accent: '#4A8FB8',
    soft: 'rgba(74,143,184,0.16)',
    wash: ['#F6FAFC', '#DCEEF8'],
    darkWash: ['rgba(74,143,184,0.08)', 'rgba(74,143,184,0.22)'],
  },
  plum: {
    accent: '#9A5B7C',
    soft: 'rgba(154,91,124,0.16)',
    wash: ['#FCF7FA', '#F2DFEA'],
    darkWash: ['rgba(154,91,124,0.08)', 'rgba(154,91,124,0.22)'],
  },
  cocoa: {
    accent: '#A67C52',
    soft: 'rgba(166,124,82,0.16)',
    wash: ['#FCFAF7', '#F2E6D8'],
    darkWash: ['rgba(166,124,82,0.08)', 'rgba(166,124,82,0.22)'],
  },
  teal: {
    accent: '#3D8B8B',
    soft: 'rgba(61,139,139,0.16)',
    wash: ['#F5FBFA', '#D7EFEE'],
    darkWash: ['rgba(61,139,139,0.08)', 'rgba(61,139,139,0.22)'],
  },
  berry: {
    accent: '#C44569',
    soft: 'rgba(196,69,105,0.16)',
    wash: ['#FFF7F9', '#F9D9E3'],
    darkWash: ['rgba(196,69,105,0.08)', 'rgba(196,69,105,0.24)'],
  },
  slate: {
    accent: '#6B7A95',
    soft: 'rgba(107,122,149,0.16)',
    wash: ['#F7F8FB', '#E2E7F0'],
    darkWash: ['rgba(107,122,149,0.08)', 'rgba(107,122,149,0.22)'],
  },
};

export interface PlayActivity {
  id: ExploreModalKey;
  title: string;
  tagline: string;
  icon: IconName;
  art: ActivityArtId;
  group: PlayGroupId;
  tone: PlayToneId;
  cta?: string;
}

export interface PlayGroup {
  id: PlayGroupId;
  label: string;
  chip: string;
}

export const HOME_FILTERS: { id: HomeFilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'play', label: 'Games' },
  { id: 'quizzes', label: 'Quizzes' },
  { id: 'talk', label: 'Prompts' },
  { id: 'challenges', label: 'Challenges' },
  { id: 'create', label: 'More' },
];

export const PLAY_GROUPS: PlayGroup[] = [
  { id: 'play', label: 'Play a game', chip: 'Games' },
  { id: 'quizzes', label: 'Quizzes', chip: 'Quizzes' },
  { id: 'talk', label: 'Conversation prompts', chip: 'Prompts' },
  { id: 'challenges', label: 'Challenges', chip: 'Challenges' },
  { id: 'create', label: 'Create & go out', chip: 'More' },
];

/** Games, quizzes, prompts, challenges, and more. */
export const PLAY_ACTIVITIES: PlayActivity[] = [
  {
    id: 'wouldYouRather',
    title: 'Would You Rather?',
    tagline: 'Hard choices. Soft laughs.',
    icon: 'question',
    art: 'wouldYouRather',
    group: 'play',
    tone: 'sky',
  },
  {
    id: 'thisOrThat',
    title: 'This or That',
    tagline: 'Quick picks. Instant reveals.',
    icon: 'sparkles',
    art: 'thisOrThat',
    group: 'play',
    tone: 'coral',
  },
  {
    id: 'whosLikely',
    title: "Who's More Likely?",
    tagline: 'Point fingers. Then compare.',
    icon: 'eye',
    art: 'whosLikely',
    group: 'play',
    tone: 'plum',
  },
  {
    id: 'truth',
    title: 'Truth or Dare',
    tagline: 'Couples safe rounds.',
    icon: 'fire',
    art: 'truthDare',
    group: 'play',
    tone: 'berry',
  },
  {
    id: 'twoTruths',
    title: 'Two Truths & a Lie',
    tagline: 'Spot the fib.',
    icon: 'eye',
    art: 'whosLikely',
    group: 'play',
    tone: 'slate',
  },
  {
    id: 'neverHaveI',
    title: 'Never Have I Ever',
    tagline: 'Light confessions.',
    icon: 'fire',
    art: 'neverHaveI',
    group: 'play',
    tone: 'amber',
  },
  {
    id: 'emojiStory',
    title: 'Emoji Story',
    tagline: 'Guess the night.',
    icon: 'sparkles',
    art: 'emojiStory',
    group: 'play',
    tone: 'teal',
  },
  {
    id: 'guessAnswer',
    title: 'Guess My Answer',
    tagline: 'They type. You guess.',
    icon: 'chat',
    art: 'guessAnswer',
    group: 'play',
    tone: 'sage',
  },
  {
    id: 'fortuneWheel',
    title: 'Love Fortune Wheel',
    tagline: 'Spin for a tiny dare.',
    icon: 'spark',
    art: 'wheel',
    group: 'play',
    tone: 'rose',
  },
  {
    id: 'trivia',
    title: 'Couples Trivia',
    tagline: 'Fun facts about love.',
    icon: 'star',
    art: 'trivia',
    group: 'play',
    tone: 'cocoa',
  },
  {
    id: 'games',
    title: 'Mini Games',
    tagline: 'A mixed bag of rounds.',
    icon: 'gamepad',
    art: 'thisOrThat',
    group: 'play',
    tone: 'coral',
  },
  {
    id: 'loveQuiz',
    title: 'How well do you know me?',
    tagline: 'One answers — the other guesses.',
    icon: 'heart',
    art: 'loveQuiz',
    group: 'quizzes',
    tone: 'rose',
  },
  {
    id: 'quiz',
    title: 'Love Language',
    tagline: 'How you each feel loved.',
    icon: 'heart',
    art: 'compatibility',
    group: 'quizzes',
    tone: 'berry',
  },
  {
    id: 'quizLive',
    title: 'Quiz Live',
    tagline: 'Compete from your phones.',
    icon: 'globe',
    art: 'quizLive',
    group: 'quizzes',
    tone: 'sky',
  },
  {
    id: 'memory',
    title: 'Memory Quiz',
    tagline: 'How well do you remember?',
    icon: 'journal',
    art: 'memory',
    group: 'quizzes',
    tone: 'teal',
  },
  {
    id: 'compatibility',
    title: 'Compatibility',
    tagline: 'See where you align.',
    icon: 'sparkles',
    art: 'compatibility',
    group: 'quizzes',
    tone: 'plum',
  },
  {
    id: 'personality',
    title: 'Personality',
    tagline: 'Your vibe, side by side.',
    icon: 'user',
    art: 'personality',
    group: 'quizzes',
    tone: 'amber',
  },
  {
    id: 'attachment',
    title: 'Attachment Style',
    tagline: 'How you need to feel close.',
    icon: 'people',
    art: 'attachment',
    group: 'quizzes',
    tone: 'sky',
  },

  {
    id: 'cards',
    title: 'Conversation Cards',
    tagline: 'Deep, funny, romantic prompts.',
    icon: 'cards',
    art: 'cards',
    group: 'talk',
    tone: 'rose',
    cta: 'Start',
  },
  {
    id: 'thirtySix',
    title: '36 Questions',
    tagline: 'Unlock one at a time.',
    icon: 'list',
    art: 'thirtySix',
    group: 'talk',
    tone: 'slate',
    cta: 'Start',
  },
  {
    id: 'appreciation',
    title: 'Appreciation',
    tagline: 'One grateful note.',
    icon: 'heart',
    art: 'appreciation',
    group: 'talk',
    tone: 'coral',
    cta: 'Start',
  },
  {
    id: 'finishSentence',
    title: 'Finish the Sentence',
    tagline: 'I knew I loved you when…',
    icon: 'journal',
    art: 'finishSentence',
    group: 'talk',
    tone: 'plum',
    cta: 'Start',
  },
  {
    id: 'gratitude',
    title: 'Gratitude Swap',
    tagline: 'Three things you noticed.',
    icon: 'heart',
    art: 'gratitude',
    group: 'talk',
    tone: 'sage',
    cta: 'Start',
  },
  {
    id: 'daily',
    title: 'Question of the Day',
    tagline: 'One light prompt.',
    icon: 'journal',
    art: 'cards',
    group: 'talk',
    tone: 'sky',
    cta: 'Start',
  },

  {
    id: 'weekChallenge',
    title: '7 Day Connection',
    tagline: 'Tiny habits. Big payoff.',
    icon: 'target',
    art: 'challenge',
    group: 'challenges',
    tone: 'amber',
    cta: 'Start',
  },
  {
    id: 'dateNight',
    title: 'Date Night Challenge',
    tagline: 'Complete together this week.',
    icon: 'calendar',
    art: 'dateNight',
    group: 'challenges',
    tone: 'berry',
    cta: 'Start',
  },
  {
    id: 'bucket',
    title: 'Bucket List',
    tagline: 'Dreams to chase together.',
    icon: 'list',
    art: 'bucket',
    group: 'challenges',
    tone: 'teal',
    cta: 'Start',
  },
  {
    id: 'goals',
    title: 'Shared Goals',
    tagline: 'Track progress as a team.',
    icon: 'target',
    art: 'goals',
    group: 'challenges',
    tone: 'cocoa',
    cta: 'Start',
  },

  {
    id: 'drawTogether',
    title: 'Draw Together',
    tagline: 'Same prompt. Same reveal.',
    icon: 'image',
    art: 'draw',
    group: 'create',
    tone: 'coral',
  },
  {
    id: 'compliment',
    title: 'Compliment Jar',
    tagline: 'Notes to open later.',
    icon: 'gift',
    art: 'compliment',
    group: 'create',
    tone: 'rose',
  },
  {
    id: 'playlist',
    title: 'Playlist for Two',
    tagline: 'A song for this moment.',
    icon: 'volumeHigh',
    art: 'playlist',
    group: 'create',
    tone: 'plum',
  },
  {
    id: 'dateGenerator',
    title: 'Date Generator',
    tagline: 'Shake up tonight.',
    icon: 'compass',
    art: 'dateGenerator',
    group: 'create',
    tone: 'sage',
  },
];

export function getPlayTone(tone: PlayToneId): PlayTone {
  return PLAY_TONES[tone];
}

export function sectionsForFilter(
  filter: HomeFilterId,
  query: string,
): { group: PlayGroup; items: PlayActivity[] }[] {
  const q = query.trim().toLowerCase();
  const match = (a: PlayActivity) =>
    !q || a.title.toLowerCase().includes(q) || a.tagline.toLowerCase().includes(q);

  const groups =
    filter === 'all' ? PLAY_GROUPS : PLAY_GROUPS.filter((g) => g.id === filter);

  return groups
    .map((group) => ({
      group,
      items: PLAY_ACTIVITIES.filter((a) => a.group === group.id && match(a)),
    }))
    .filter((s) => s.items.length > 0);
}
