export const WATCH_REACTIONS = ['❤️', '😂', '😮', '🔥', '👏', '😭'] as const;

/** Labelled quick reactions shown in the watch room. */
export const WATCH_QUICK_REACTIONS: { emoji: string; label: string }[] = [
  { emoji: '❤️', label: 'Love this scene' },
  { emoji: '😂', label: 'Funny moment' },
  { emoji: '😭', label: 'Emotional' },
  { emoji: '😲', label: 'Plot twist' },
  { emoji: '🔥', label: 'Favorite scene' },
];

/** Free couples can start this many live watch parties per rolling week. */
export const FREE_WATCH_PARTIES_PER_WEEK = 3;

export const WATCH_REMINDER_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 15, label: '15 min before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 1440, label: '1 day before' },
];

export const WATCH_VOTE_OPTIONS: { value: 'must' | 'interested' | 'not'; emoji: string; label: string }[] = [
  { value: 'must', emoji: '🍿', label: 'Must watch' },
  { value: 'interested', emoji: '👍', label: 'Interested' },
  { value: 'not', emoji: '🙅', label: 'Not for me' },
];

/** Relationship prompts surfaced after a session ends. */
export const WATCH_POST_PROMPTS = [
  'What was your favorite scene?',
  'Which character are you most like?',
  'Would you watch this again?',
  'What did this remind you of about us?',
  'What should we watch next?',
] as const;

export interface WatchBadge {
  id: string;
  title: string;
  description: string;
  emoji: string;
}

export const WATCH_BADGES: (WatchBadge & {
  earned: (stats: { watched: number; streakWeeks: number; platforms: number }) => boolean;
})[] = [
  {
    id: 'first_night',
    title: 'First Movie Night',
    description: 'Watch your first thing together',
    emoji: '🎬',
    earned: (s) => s.watched >= 1,
  },
  {
    id: 'ten_movies',
    title: '10 Watched',
    description: 'Finish 10 watch parties',
    emoji: '🍿',
    earned: (s) => s.watched >= 10,
  },
  {
    id: 'streak_4',
    title: '4-Week Streak',
    description: 'Watch together 4 weeks in a row',
    emoji: '🔥',
    earned: (s) => s.streakWeeks >= 4,
  },
  {
    id: 'genre_explorer',
    title: 'Genre Explorer',
    description: 'Watch across 3+ platforms',
    emoji: '🧭',
    earned: (s) => s.platforms >= 3,
  },
];
