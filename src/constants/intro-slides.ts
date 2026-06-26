import type { IconName } from '@/components/ui/Icon';

export type IntroSlideId = 'moments' | 'connection' | 'together' | 'private';

export type IntroSlide = {
  id: IntroSlideId;
  title: string;
  highlight: string;
  body: string;
  icons: IconName[];
};

export const INTRO_SLIDES: IntroSlide[] = [
  {
    id: 'moments',
    title: 'Capture',
    highlight: 'little moments',
    body: 'Share photos, voice notes, and daily glimpses that only the two of you get to keep.',
    icons: ['camera', 'heart', 'sparkles'],
  },
  {
    id: 'connection',
    title: 'Stay',
    highlight: 'in sync',
    body: 'Chat, share moods, and build streaks that celebrate showing up for each other.',
    icons: ['chat', 'fire', 'heart'],
  },
  {
    id: 'together',
    title: 'Plan',
    highlight: 'your adventures',
    body: 'Date ideas, shared calendars, watch nights, and activities made for couples.',
    icons: ['calendar', 'film', 'gift'],
  },
  {
    id: 'private',
    title: 'A space',
    highlight: 'just for two',
    body: 'No feeds, no followers — only you and your partner in a private home built for love.',
    icons: ['lock', 'heart', 'sparkles'],
  },
];
