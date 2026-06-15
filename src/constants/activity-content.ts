export const CARD_CATEGORIES = ['deep', 'romantic', 'funny', 'weird', 'future'] as const;

export const CARD_PROMPTS: Record<string, string[]> = {
  deep: [
    'What made you fall for me?',
    'What do you need more of from me?',
    'What fear do you trust me with?',
    'When did you feel closest to me this year?',
    'What part of yourself are you most proud of?',
  ],
  romantic: [
    'Describe our perfect evening together.',
    'When did you last feel butterflies with me?',
    'What song always reminds you of us?',
    'What is your favorite memory of us so far?',
    'What small thing I do makes you melt?',
  ],
  funny: [
    "What's my weirdest habit?",
    'If we were a sitcom, what would it be called?',
    'Roast me lovingly in one sentence.',
    "What's the most ridiculous thing we've done together?",
    'If I were an animal, which one would I be?',
  ],
  weird: [
    'Would you rather fight 100 duck-sized horses or 1 horse-sized duck?',
    'If we shared one superpower, what should it be?',
    "What's our zombie apocalypse survival plan?",
    'If you could read my mind for a day, would you?',
    'What conspiracy theory could you see me believing?',
  ],
  future: [
    'Where do you see us in 5 years?',
    'What adventure should we plan next?',
    'Describe our dream home.',
    'What tradition should we start together?',
    'What do you hope we never stop doing?',
  ],
};

export interface GameRound {
  prompt: string;
  options?: string[];
  answer?: string;
}

export interface Game {
  name: string;
  emoji: string;
  desc: string;
  rounds: GameRound[];
}

export const GAMES: Game[] = [
  {
    name: 'Would You Rather',
    emoji: '🤔',
    desc: 'Pick one — then explain why',
    rounds: [
      { prompt: 'Would you rather…', options: ['Travel the world for a year', 'Own your dream home'] },
      { prompt: 'Would you rather…', options: ['Always be 10 min early', 'Always be 20 min late'] },
      { prompt: 'Would you rather…', options: ['Relive our first date', 'Fast-forward to our 50th anniversary'] },
      { prompt: 'Would you rather…', options: ['Never argue again', 'Always win every argument'] },
      { prompt: 'Would you rather…', options: ['A cozy night in', 'A wild night out'] },
    ],
  },
  {
    name: 'This or That',
    emoji: '⚡',
    desc: 'Quick-fire favorites',
    rounds: [
      { prompt: 'This or that?', options: ['Beach', 'Mountains'] },
      { prompt: 'This or that?', options: ['Coffee', 'Tea'] },
      { prompt: 'This or that?', options: ['Movie night', 'Game night'] },
      { prompt: 'This or that?', options: ['Sunrise', 'Sunset'] },
      { prompt: 'This or that?', options: ['Texting', 'Calling'] },
    ],
  },
  {
    name: 'Never Have I Ever',
    emoji: '🙈',
    desc: 'Confess and laugh',
    rounds: [
      { prompt: 'Never have I ever… stalked an ex online.' },
      { prompt: 'Never have I ever… fallen asleep during a movie date.' },
      { prompt: 'Never have I ever… re-read our old messages.' },
      { prompt: 'Never have I ever… pretended to like a gift.' },
      { prompt: 'Never have I ever… planned our wedding in my head.' },
    ],
  },
  {
    name: 'Truth or Dare',
    emoji: '🎲',
    desc: 'Spice things up',
    rounds: [
      { prompt: 'Truth: What was your first impression of me?' },
      { prompt: 'Dare: Send me your favorite selfie right now.' },
      { prompt: 'Truth: What is one secret you never told me?' },
      { prompt: 'Dare: Do your best impression of me.' },
      { prompt: 'Truth: What do you find most attractive about me?' },
    ],
  },
  {
    name: 'Emoji Guess',
    emoji: '🧩',
    desc: 'Guess the movie',
    rounds: [
      { prompt: '🦁👑', answer: 'The Lion King' },
      { prompt: '🚢🧊💔', answer: 'Titanic' },
      { prompt: '👻🚫', answer: 'Ghostbusters' },
      { prompt: '🐠🔍', answer: 'Finding Nemo' },
      { prompt: '🕷️🧑', answer: 'Spider-Man' },
    ],
  },
];

export interface DateIdea {
  title: string;
  description: string;
  type: 'home' | 'outdoor' | 'virtual' | 'special';
  vibe: string;
  cost: string;
  duration: string;
  emoji: string;
}

export const DATE_IDEAS: DateIdea[] = [
  { title: 'Candlelit cook-off', description: 'Cook the same recipe and rate each other.', type: 'home', vibe: 'romantic', cost: '$', duration: '2h', emoji: '🍝' },
  { title: 'Blanket fort movie marathon', description: 'Build a fort, pick a trilogy, snacks mandatory.', type: 'home', vibe: 'cozy', cost: 'free', duration: '4h', emoji: '🎬' },
  { title: 'Sunrise hike', description: 'Catch the first light from a viewpoint.', type: 'outdoor', vibe: 'adventurous', cost: 'free', duration: '3h', emoji: '🌄' },
  { title: 'Farmers market stroll', description: 'Find an ingredient neither of you has tried.', type: 'outdoor', vibe: 'calm', cost: '$', duration: '1.5h', emoji: '🧺' },
  { title: 'Synced watch party', description: 'Press play together and react in chat.', type: 'virtual', vibe: 'fun', cost: 'free', duration: '2h', emoji: '📺' },
  { title: 'Online cooking class', description: 'Follow a live class from your own kitchens.', type: 'virtual', vibe: 'playful', cost: '$$', duration: '2h', emoji: '👩‍🍳' },
  { title: 'Anniversary scavenger hunt', description: 'Hide clues that retrace your relationship.', type: 'special', vibe: 'romantic', cost: '$', duration: '3h', emoji: '💝' },
  { title: 'Stargazing picnic', description: 'Drive somewhere dark, bring a blanket.', type: 'special', vibe: 'dreamy', cost: '$', duration: '3h', emoji: '✨' },
];

export interface QuizOption {
  label: string;
  value: string;
}

export const LOVE_LANGUAGE_QUIZ = {
  questions: [
    {
      question: 'You feel most loved when your partner…',
      options: [
        { label: 'Tells you how much you mean to them', value: 'words' },
        { label: 'Plans uninterrupted time together', value: 'time' },
        { label: 'Surprises you with a thoughtful gift', value: 'gifts' },
        { label: 'Helps with something without being asked', value: 'acts' },
        { label: 'Holds your hand or hugs you', value: 'touch' },
      ],
    },
    {
      question: 'A perfect evening looks like…',
      options: [
        { label: 'Deep conversation and compliments', value: 'words' },
        { label: 'A device-free dinner together', value: 'time' },
        { label: 'Exchanging little surprises', value: 'gifts' },
        { label: 'They cook while you relax', value: 'acts' },
        { label: 'Cuddling on the couch', value: 'touch' },
      ],
    },
    {
      question: 'You get a little hurt when they…',
      options: [
        { label: 'Forget to acknowledge your effort', value: 'words' },
        { label: 'Are distracted when you are together', value: 'time' },
        { label: 'Forget special occasions', value: 'gifts' },
        { label: 'Leave you to handle everything', value: 'acts' },
        { label: 'Are not very affectionate', value: 'touch' },
      ],
    },
  ],
  results: {
    words: { title: 'Words of Affirmation', description: 'You thrive on heartfelt words, encouragement and verbal appreciation.' },
    time: { title: 'Quality Time', description: 'Undivided attention and shared experiences make you feel most loved.' },
    gifts: { title: 'Receiving Gifts', description: 'Thoughtful tokens — big or small — speak straight to your heart.' },
    acts: { title: 'Acts of Service', description: 'Actions speak louder than words; helpful gestures mean everything.' },
    touch: { title: 'Physical Touch', description: 'Closeness and affectionate touch are your strongest connection.' },
  } as Record<string, { title: string; description: string }>,
};

