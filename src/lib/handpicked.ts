import type { ActivityArtId } from '@/components/activities/explore/ActivityArt';
import {
  PLAY_ACTIVITIES,
  type ExploreModalKey,
  type PlayActivity,
  type PlayToneId,
} from '@/components/activities/explore/explore-catalog';

/**
 * Handpicked: the fixed library (question packs, quizzes, prompts, activities), organised by the
 * area of the relationship it helps with. Packs are answered separately and unlocked together.
 */

export type AreaId =
  | 'communication'
  | 'intimacy'
  | 'fun'
  | 'conflict'
  | 'money'
  | 'future'
  | 'family'
  | 'growth'
  | 'home'
  | 'romance'
  | 'trust'
  | 'distance'
  | 'knowing'
  | 'story';

export type Depth = 'light' | 'real' | 'deep';

export type HandpickedFormat = 'questions' | 'quizzes' | 'prompts' | 'activities';

export interface Area {
  id: AreaId;
  title: string;
  blurb: string;
  tone: PlayToneId;
  art: ActivityArtId;
}

export interface PackQuestion {
  id: string;
  text: string;
  /** Quick answers to tap; a written note is always optional on top. Absent = write your own. */
  picks?: string[];
}

export interface QuestionPack {
  id: string;
  area: AreaId;
  title: string;
  depth: Depth;
  questions: PackQuestion[];
}

export const AREAS: Area[] = [
  {
    id: 'knowing',
    title: 'Getting to know you',
    blurb: 'Light questions to learn something new about each other.',
    tone: 'amber',
    art: 'thirtySix',
  },
  {
    id: 'story',
    title: 'Our story',
    blurb: 'How you met, your firsts and the memories you share.',
    tone: 'plum',
    art: 'memory',
  },
  { id: 'fun', title: 'Fun', blurb: 'Play, laugh and keep things light.', tone: 'coral', art: 'neverHaveI' },
  {
    id: 'romance',
    title: 'Romance',
    blurb: 'Date nights, surprises and keeping the spark alive.',
    tone: 'rose',
    art: 'dateNight',
  },
  {
    id: 'intimacy',
    title: 'Intimacy',
    blurb: 'Closeness, affection and feeling wanted.',
    tone: 'berry',
    art: 'appreciation',
  },
  {
    id: 'communication',
    title: 'Communication',
    blurb: 'Feel heard, ask better questions, say the hard things kindly.',
    tone: 'sky',
    art: 'cards',
  },
  {
    id: 'trust',
    title: 'Trust',
    blurb: 'Honesty, jealousy and feeling secure with each other.',
    tone: 'teal',
    art: 'attachment',
  },
  { id: 'conflict', title: 'Conflict', blurb: 'Disagree well and repair faster.', tone: 'sage', art: 'attachment' },
  {
    id: 'distance',
    title: 'Long distance',
    blurb: 'Staying close when you’re miles apart.',
    tone: 'sky',
    art: 'compliment',
  },
  {
    id: 'home',
    title: 'Home life',
    blurb: 'Routines, chores and the life you share day to day.',
    tone: 'slate',
    art: 'challenge',
  },
  {
    id: 'family',
    title: 'Family',
    blurb: 'Families, friends and the people around you.',
    tone: 'amber',
    art: 'personality',
  },
  {
    id: 'money',
    title: 'Money',
    blurb: 'Spending, saving and what money means to each of you.',
    tone: 'cocoa',
    art: 'goals',
  },
  { id: 'growth', title: 'Growth', blurb: 'Who you’re becoming, alone and together.', tone: 'sage', art: 'gratitude' },
  {
    id: 'future',
    title: 'Future',
    blurb: 'Dreams, plans and where you’re headed together.',
    tone: 'plum',
    art: 'bucket',
  },
];

export const DEPTHS: { id: Depth; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'real', label: 'Real' },
  { id: 'deep', label: 'Deep' },
];

export const FORMATS: { id: HandpickedFormat; label: string }[] = [
  { id: 'questions', label: 'Questions' },
  { id: 'quizzes', label: 'Quizzes' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'activities', label: 'Activities' },
];

const q = (id: string, text: string, picks?: string[]): PackQuestion => ({ id, text, picks });

export const PACKS: QuestionPack[] = [
  {
    id: 'comm-day',
    area: 'communication',
    title: 'How was your day, really?',
    depth: 'light',
    questions: [
      q('1', 'What part of your day would you replay if you could?'),
      q('2', 'When do you most like to talk about your day?', [
        'Right when we see each other',
        'Over dinner',
        'In bed',
        'Later, once I’ve unwound',
      ]),
      q('3', 'What’s something small that happened today that I’d never guess?'),
      q('4', 'When you vent, what do you want from me?', [
        'Just listen',
        'Help me fix it',
        'Take my side',
        'Distract me',
      ]),
      q('5', 'What’s a question I could ask that would get a better answer than “how was your day”?'),
      q('6', 'How do you know I’m actually listening?', [
        'Eye contact',
        'Phone down',
        'I ask follow up questions',
        'I remember it later',
      ]),
    ],
  },
  {
    id: 'comm-hard',
    area: 'communication',
    title: 'Saying the hard thing kindly',
    depth: 'real',
    questions: [
      q('1', 'When did you last feel really heard by me, and what did I do?', [
        'Late night talk',
        'Over dinner',
        'On a walk',
        'Something else',
      ]),
      q('2', 'Is there something you’ve been holding back because the timing never felt right?'),
      q('3', 'How should I bring up something that’s bothering me?', [
        'Straight away',
        'At a calm moment',
        'Write it down first',
        'Ask if now’s a good time',
      ]),
      q('4', 'What tone of mine makes it hard to hear what I’m saying?'),
      q('5', 'What helps you open up when you’re feeling closed off?'),
      q('6', 'What’s one thing you wish I’d ask you about more often?'),
    ],
  },
  {
    id: 'int-feel',
    area: 'intimacy',
    title: 'Feeling close',
    depth: 'light',
    questions: [
      q('1', 'What’s the quickest way for me to make you feel loved?', [
        'A long hug',
        'Kind words',
        'Doing something for you',
        'Quality time',
        'A small gift',
      ]),
      q('2', 'What’s a moment recently when you felt really close to me?'),
      q('3', 'What’s your favourite kind of physical affection that isn’t sexual?', [
        'Holding hands',
        'Cuddling',
        'Head on shoulder',
        'Kisses on the forehead',
      ]),
      q('4', 'What do I do that makes you feel wanted?'),
      q('5', 'When do you feel most attractive around me?'),
      q('6', 'What’s one tiny ritual you’d love us to start?'),
    ],
  },
  {
    id: 'int-deep',
    area: 'intimacy',
    title: 'Letting each other in',
    depth: 'deep',
    questions: [
      q('1', 'What’s something about you that you still feel shy sharing with me?'),
      q('2', 'When do you feel most emotionally safe with me?'),
      q('3', 'Is there a need you have that you’re afraid is “too much”?'),
      q('4', 'What does feeling desired look like to you?'),
      q('5', 'What would you like more of from me, without having to ask?'),
      q('6', 'What’s something you love about us that you’ve never said out loud?'),
    ],
  },
  {
    id: 'fun-firsts',
    area: 'story',
    title: 'Our firsts',
    depth: 'light',
    questions: [
      q('1', 'What was your first impression of me?', ['Cute', 'Intimidating', 'Funny', 'Didn’t notice me at first']),
      q('2', 'What’s a first we haven’t had yet that you want?'),
      q('3', 'Which of our early dates do you remember best?'),
      q('4', 'Who said “I love you” first, and how did it happen?'),
      q('5', 'What song reminds you of the start of us?'),
      q('6', 'What’s the most “us” thing we’ve ever done?'),
    ],
  },
  {
    id: 'fun-hypothetical',
    area: 'fun',
    title: 'Silly hypotheticals',
    depth: 'light',
    questions: [
      q('1', 'If we were a duo in a movie, what genre would it be?', [
        'Romantic comedy',
        'Heist',
        'Buddy comedy',
        'Disaster movie',
      ]),
      q('2', 'Which of us survives longer in a zombie apocalypse?', ['Me', 'You', 'Neither, honestly']),
      q('3', 'If we swapped lives for a day, what would you do first as me?'),
      q('4', 'What would our couple name be?'),
      q('5', 'If we opened a tiny shop together, what would we sell?'),
      q('6', 'Which fictional couple are we most like?'),
    ],
  },
  {
    id: 'conflict-repair',
    area: 'conflict',
    title: 'After an argument',
    depth: 'real',
    questions: [
      q('1', 'After an argument, what do you need first?', ['Space', 'A hug', 'To talk it through', 'An apology']),
      q('2', 'How can you tell I’m ready to make up?'),
      q('3', 'What’s a way of apologising that actually lands for you?', [
        'Saying sorry clearly',
        'Explaining what I learned',
        'Changing the behaviour',
        'A gesture',
      ]),
      q('4', 'Is there an old argument that still feels unfinished?'),
      q('5', 'What’s something I do in a fight that makes it worse?'),
      q('6', 'What’s something I do that helps us calm down?'),
    ],
  },
  {
    id: 'conflict-style',
    area: 'conflict',
    title: 'How we disagree',
    depth: 'deep',
    questions: [
      q('1', 'How did your family handle conflict when you were growing up?'),
      q('2', 'When we disagree, do you tend to pull away or push in?', [
        'Pull away',
        'Push in',
        'Depends on the topic',
      ]),
      q('3', 'What’s a fear that shows up for you when we argue?'),
      q('4', 'What’s a rule you’d like us to have for fighting fair?'),
      q('5', 'What topic do we avoid because it always turns into a fight?'),
      q('6', 'What would a “good” disagreement look like for us?'),
    ],
  },
  {
    id: 'money-meaning',
    area: 'money',
    title: 'What money means to us',
    depth: 'real',
    questions: [
      q('1', 'Are you more of a saver or a spender?', ['Saver', 'Spender', 'Somewhere in between']),
      q('2', 'What did you learn about money growing up?'),
      q('3', 'What’s a purchase that felt completely worth it?'),
      q('4', 'What makes you anxious about money right now?'),
      q('5', 'How should we split shared costs?', ['50/50', 'By income', 'Fully shared', 'Let’s talk']),
      q('6', 'What would you do with a surprise windfall?'),
    ],
  },
  {
    id: 'money-goals',
    area: 'money',
    title: 'Money goals',
    depth: 'light',
    questions: [
      q('1', 'What’s one thing worth saving up for together?'),
      q('2', 'How often should we check in about money?', [
        'Weekly',
        'Monthly',
        'When something comes up',
        'Never, please',
      ]),
      q('3', 'What’s your money “treat” that you never want to give up?'),
      q('4', 'What does feeling financially secure look like for you?'),
      q('5', 'Would you rather have more money or more free time?', ['More money', 'More time']),
      q('6', 'What’s one money habit you’d like us to build?'),
    ],
  },
  {
    id: 'future-dreams',
    area: 'future',
    title: 'Dreaming out loud',
    depth: 'light',
    questions: [
      q('1', 'Where would you love us to live one day?', [
        'A big city',
        'By the sea',
        'The countryside',
        'Somewhere abroad',
      ]),
      q('2', 'What’s a trip we have to take together?'),
      q('3', 'What does a perfect ordinary Sunday look like in five years?'),
      q('4', 'What’s a skill you’d love us to learn together?'),
      q('5', 'What’s one thing on your bucket list I don’t know about?'),
      q('6', 'What are you most excited about for us?'),
    ],
  },
  {
    id: 'future-big',
    area: 'future',
    title: 'The big questions',
    depth: 'deep',
    questions: [
      q('1', 'How do you picture our life in ten years?'),
      q('2', 'What does commitment mean to you?'),
      q('3', 'How do you feel about kids, right now?', [
        'Definitely yes',
        'Maybe one day',
        'Not for me',
        'Still working it out',
      ]),
      q('4', 'What would you never want to compromise on?'),
      q('5', 'What’s a fear you have about the future?'),
      q('6', 'What legacy would you want us to leave?'),
    ],
  },
  {
    id: 'family-roots',
    area: 'family',
    title: 'Where we come from',
    depth: 'real',
    questions: [
      q('1', 'What family tradition do you want to keep?'),
      q('2', 'Which family member are you most like?'),
      q('3', 'How often do you want to see family?', ['Every week', 'Every month', 'For holidays', 'Rarely']),
      q('4', 'What’s something about your family you want me to understand?'),
      q('5', 'What did your parents get right about love?'),
      q('6', 'What’s one thing you’d do differently from how you were raised?'),
    ],
  },
  {
    id: 'family-friends',
    area: 'family',
    title: 'Friends and us',
    depth: 'light',
    questions: [
      q('1', 'Which of my friends do you like the most?'),
      q('2', 'How much time should we spend with friends vs just us?', [
        'Mostly us',
        'Half and half',
        'Mostly friends',
      ]),
      q('3', 'What couple do you think we’d be great friends with?'),
      q('4', 'Is there a friendship you wish you’d kept up?'),
      q('5', 'What kind of host are we?', ['Big parties', 'Small dinners', 'Never host', 'Friends dropping by']),
      q('6', 'How can I support your friendships better?'),
    ],
  },
  {
    id: 'growth-becoming',
    area: 'growth',
    title: 'Who we’re becoming',
    depth: 'real',
    questions: [
      q('1', 'How have you changed since we met?'),
      q('2', 'What’s something you’re proud of this year?'),
      q('3', 'What’s a goal you want me to cheer you on for?'),
      q('4', 'How do I help you grow?', ['I push you', 'I believe in you', 'I give you space', 'I keep you honest']),
      q('5', 'What’s a habit you’re trying to break?'),
      q('6', 'Who do you want to be in five years?'),
    ],
  },
  {
    id: 'growth-gratitude',
    area: 'growth',
    title: 'Gratitude moments',
    depth: 'light',
    questions: [
      q('1', 'What’s something I did lately that you’re grateful for?'),
      q('2', 'What’s a quality of mine you admire?'),
      q('3', 'What’s a hard moment we got through that made us stronger?'),
      q('4', 'How do you like to be thanked?', ['Words', 'A note', 'A hug', 'Return the favour']),
      q('5', 'What’s something about our life you never want to take for granted?'),
      q('6', 'What’s one thing you’d like to thank yourself for?'),
    ],
  },
  {
    id: 'home-routines',
    area: 'home',
    title: 'Our everyday',
    depth: 'light',
    questions: [
      q('1', 'Are you a morning person or a night owl?', ['Morning', 'Night owl', 'Neither, I’m always tired']),
      q('2', 'Which chore do you secretly not mind?'),
      q('3', 'What makes our home feel like home?'),
      q('4', 'How tidy is tidy enough?', ['Spotless', 'Mostly neat', 'Organised chaos', 'What mess?']),
      q('5', 'What’s your favourite part of our weekly routine?'),
      q('6', 'What one change would make weekdays easier?'),
    ],
  },
  {
    id: 'home-balance',
    area: 'home',
    title: 'Sharing the load',
    depth: 'real',
    questions: [
      q('1', 'Does the mental load at home feel fair right now?', [
        'Yes, it’s balanced',
        'Mostly',
        'Not really',
        'Let’s talk',
      ]),
      q('2', 'What’s a task you do that I might not notice?'),
      q('3', 'Which job would you happily swap with me?'),
      q('4', 'How do you like to unwind after work?', [
        'Alone time',
        'Together time',
        'Something active',
        'Doing nothing',
      ]),
      q('5', 'What makes you feel supported at home?'),
      q('6', 'What’s one home thing we should plan this month?'),
    ],
  },
  {
    id: 'romance-spark',
    area: 'romance',
    title: 'Keeping the spark',
    depth: 'light',
    questions: [
      q('1', 'What’s your idea of a perfect date with me?', [
        'A fancy dinner',
        'A cosy night in',
        'Something adventurous',
        'Somewhere new',
      ]),
      q('2', 'What’s the most romantic thing I’ve ever done for you?'),
      q('3', 'How often would you like a proper date night?', [
        'Every week',
        'Every two weeks',
        'Once a month',
        'Whenever it happens',
      ]),
      q('4', 'What small surprise would make your whole week?'),
      q('5', 'Which song would you want us to slow dance to?'),
      q('6', 'What’s a date we haven’t done yet that you’d love to plan?'),
    ],
  },
  {
    id: 'romance-feel',
    area: 'romance',
    title: 'What makes you feel romanced',
    depth: 'real',
    questions: [
      q('1', 'What makes a gesture feel romantic to you, rather than just nice?'),
      q('2', 'Do you prefer planned romance or spontaneous romance?', ['Planned', 'Spontaneous', 'A bit of both']),
      q('3', 'When did you last feel truly swept off your feet by me?'),
      q('4', 'What’s something romantic you’ve always wanted but never asked for?'),
      q('5', 'How do you like to be flirted with?', [
        'Compliments',
        'Playful teasing',
        'A look across the room',
        'Love notes',
      ]),
      q('6', 'What would you love us to do on our next anniversary?'),
    ],
  },
  {
    id: 'trust-secure',
    area: 'trust',
    title: 'Feeling secure',
    depth: 'real',
    questions: [
      q('1', 'What helps you feel secure in our relationship?'),
      q('2', 'When do you feel most trusted by me?'),
      q('3', 'How much do you like to know about each other’s day?', [
        'Everything',
        'The highlights',
        'Only what matters',
        'Whatever comes up',
      ]),
      q('4', 'Is there anything that makes you feel uneasy that we haven’t talked about?'),
      q('5', 'What does being reliable look like to you?'),
      q('6', 'What’s one thing I could do to make you feel even safer with me?'),
    ],
  },
  {
    id: 'trust-honest',
    area: 'trust',
    title: 'Honesty and jealousy',
    depth: 'deep',
    questions: [
      q('1', 'Is there a small truth you’ve been holding back?'),
      q('2', 'What tends to make you feel jealous?', ['Time with others', 'Social media', 'Exes', 'Rarely anything']),
      q('3', 'How should I tell you if something is making me jealous?'),
      q('4', 'What does privacy mean to you in a relationship?'),
      q('5', 'Have you ever felt let down by me? What would have helped?'),
      q('6', 'How do we rebuild trust if one of us slips up?'),
    ],
  },
  {
    id: 'distance-close',
    area: 'distance',
    title: 'Close from afar',
    depth: 'light',
    questions: [
      q('1', 'What’s your favourite way for us to stay in touch?', [
        'Video calls',
        'Voice notes',
        'Texting all day',
        'Watching something together',
      ]),
      q('2', 'When do you miss me the most?'),
      q('3', 'What’s a little ritual we could do every day while apart?'),
      q('4', 'How often would you like us to call?', [
        'Every day',
        'Most days',
        'A few times a week',
        'Whenever we can',
      ]),
      q('5', 'What’s something I could send you that would make you smile?'),
      q('6', 'What are you most looking forward to when we’re together again?'),
    ],
  },
  {
    id: 'distance-hard',
    area: 'distance',
    title: 'When distance feels hard',
    depth: 'real',
    questions: [
      q('1', 'What’s the hardest part of being apart for you?'),
      q('2', 'How can I tell you’re having a lonely day?'),
      q('3', 'What helps most when you’re missing me?', [
        'A call',
        'A long message',
        'Planning our next visit',
        'Space to feel it',
      ]),
      q('4', 'Is there anything about our time zones or schedules we should change?'),
      q('5', 'What would make our next visit feel special?'),
      q('6', 'What does our plan to close the distance look like to you?'),
    ],
  },
  {
    id: 'knowing-basics',
    area: 'knowing',
    title: 'The little things',
    depth: 'light',
    questions: [
      q('1', 'What’s your comfort food?'),
      q('2', 'Are you an early bird or a night owl?', ['Early bird', 'Night owl', 'Depends on the day']),
      q('3', 'What’s a song you never skip?'),
      q('4', 'What did you want to be when you grew up?'),
      q('5', 'What’s your favourite way to spend a lazy Sunday?'),
      q('6', 'What’s something that always makes you laugh?'),
    ],
  },
  {
    id: 'knowing-deeper',
    area: 'knowing',
    title: 'Beyond the basics',
    depth: 'real',
    questions: [
      q('1', 'What’s a moment that changed how you see the world?'),
      q('2', 'Who has shaped you the most?'),
      q('3', 'What are you quietly proud of?'),
      q('4', 'What do people often get wrong about you?'),
      q('5', 'Where do you feel most like yourself?', ['At home', 'Outdoors', 'With friends', 'With you']),
      q('6', 'What’s a dream you’ve never told anyone?'),
    ],
  },
  {
    id: 'story-met',
    area: 'story',
    title: 'How we met',
    depth: 'light',
    questions: [
      q('1', 'What do you remember most about the day we met?'),
      q('2', 'When did you know you liked me?', [
        'Right away',
        'After a few dates',
        'It crept up on me',
        'Still deciding',
      ]),
      q('3', 'What did you think of me before we got together?'),
      q('4', 'What was our first proper conversation about?'),
      q('5', 'Who did you tell about me first?'),
      q('6', 'If our story was a movie, what would the title be?'),
    ],
  },
];

interface CatalogTag {
  area: AreaId;
  depth: Depth;
  format: Exclude<HandpickedFormat, 'questions'>;
}

/** Existing ready-made activities, filed under the area they serve. */
const CATALOG_TAGS: Partial<Record<ExploreModalKey, CatalogTag>> = {
  cards: { area: 'communication', depth: 'real', format: 'prompts' },
  thirtySix: { area: 'knowing', depth: 'deep', format: 'prompts' },
  finishSentence: { area: 'communication', depth: 'light', format: 'prompts' },
  daily: { area: 'communication', depth: 'light', format: 'prompts' },
  attachment: { area: 'communication', depth: 'deep', format: 'quizzes' },
  quiz: { area: 'intimacy', depth: 'real', format: 'quizzes' },
  loveQuiz: { area: 'intimacy', depth: 'light', format: 'quizzes' },
  appreciation: { area: 'intimacy', depth: 'light', format: 'prompts' },
  compliment: { area: 'intimacy', depth: 'light', format: 'activities' },
  neverHaveI: { area: 'fun', depth: 'light', format: 'activities' },
  emojiStory: { area: 'fun', depth: 'light', format: 'activities' },
  fortuneWheel: { area: 'fun', depth: 'light', format: 'activities' },
  trivia: { area: 'fun', depth: 'light', format: 'quizzes' },
  memory: { area: 'story', depth: 'light', format: 'quizzes' },
  games: { area: 'fun', depth: 'light', format: 'activities' },
  drawTogether: { area: 'fun', depth: 'light', format: 'activities' },
  playlist: { area: 'fun', depth: 'light', format: 'activities' },
  bucket: { area: 'future', depth: 'light', format: 'activities' },
  goals: { area: 'future', depth: 'real', format: 'activities' },
  compatibility: { area: 'growth', depth: 'real', format: 'quizzes' },
  personality: { area: 'growth', depth: 'light', format: 'quizzes' },
  gratitude: { area: 'growth', depth: 'light', format: 'prompts' },
  weekChallenge: { area: 'growth', depth: 'real', format: 'activities' },
  dateNight: { area: 'romance', depth: 'light', format: 'activities' },
  dateGenerator: { area: 'romance', depth: 'light', format: 'activities' },
};

export type HandpickedItem =
  | { kind: 'pack'; id: string; title: string; depth: Depth; format: 'questions'; pack: QuestionPack }
  | {
      kind: 'activity';
      id: ExploreModalKey;
      title: string;
      depth: Depth;
      format: CatalogTag['format'];
      activity: PlayActivity;
    };

export function getArea(id: string): Area | undefined {
  return AREAS.find((a) => a.id === id);
}

export function getPack(id: string): QuestionPack | undefined {
  return PACKS.find((p) => p.id === id);
}

export function itemsForArea(area: AreaId): HandpickedItem[] {
  const packs: HandpickedItem[] = PACKS.filter((p) => p.area === area).map((pack) => ({
    kind: 'pack',
    id: pack.id,
    title: pack.title,
    depth: pack.depth,
    format: 'questions',
    pack,
  }));
  const activities: HandpickedItem[] = PLAY_ACTIVITIES.flatMap((activity) => {
    const tag = CATALOG_TAGS[activity.id];
    if (tag?.area !== area) return [];
    return [
      {
        kind: 'activity' as const,
        id: activity.id,
        title: activity.title,
        depth: tag.depth,
        format: tag.format,
        activity,
      },
    ];
  });
  return [...packs, ...activities];
}

/** Everything of one format, grouped by area in the areas' order (the Browse circles). */
export function itemsWithFormat(format: HandpickedFormat): { area: Area; items: HandpickedItem[] }[] {
  return AREAS.map((area) => ({ area, items: itemsForArea(area.id).filter((i) => i.format === format) })).filter(
    (g) => g.items.length > 0,
  );
}

/** Ready-made activities of one format, across every area (Handpicked tab rails). */
export function activitiesWithFormat(format: CatalogTag['format']): PlayActivity[] {
  return PLAY_ACTIVITIES.filter((a) => CATALOG_TAGS[a.id]?.format === format);
}

export function areaItemCount(area: AreaId): number {
  return itemsForArea(area).length;
}

/** A pack is done for you once you've locked in every question. */
export function packProgress(pack: QuestionPack, answeredIds: Set<string>) {
  const answered = pack.questions.filter((qq) => answeredIds.has(qq.id)).length;
  return { answered, total: pack.questions.length, done: answered === pack.questions.length };
}

/** Today's featured pack: rotates daily so the "All" tab has something fresh on top. */
export function featuredPack(date = new Date()): QuestionPack {
  const day = Math.floor(date.getTime() / 86_400_000);
  return PACKS[day % PACKS.length];
}
