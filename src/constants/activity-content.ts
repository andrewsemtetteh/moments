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
      { prompt: 'Would you rather…', options: ['Beach vacation', 'Mountain adventure'] },
      { prompt: 'Would you rather…', options: ['Cook together every Sunday', 'Explore a new restaurant weekly'] },
    ],
  },
  {
    name: 'This or That',
    emoji: '⚡',
    desc: 'Quick-fire favorites',
    rounds: [
      { prompt: 'This or that?', options: ['Beach', 'Mountains'] },
      { prompt: 'This or that?', options: ['Coffee', 'Tea'] },
      { prompt: 'This or that?', options: ['Netflix', 'Cinema'] },
      { prompt: 'This or that?', options: ['Pizza', 'Sushi'] },
      { prompt: 'This or that?', options: ['Morning', 'Night'] },
      { prompt: 'This or that?', options: ['Texting', 'Calling'] },
      { prompt: 'This or that?', options: ['Sunrise', 'Sunset'] },
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

export const WHOS_MORE_LIKELY = [
  'Forget their phone at home?',
  'Cry during a movie?',
  'Plan a surprise?',
  'Sleep in on a day off?',
  'Spend a little too much?',
  'Start dancing in the kitchen?',
  'Get lost even with GPS?',
  'Send a paragraph-long text?',
];

export const FINISH_THE_SENTENCE = [
  'I knew I loved you when…',
  'Our funniest memory is…',
  'I wish we could…',
  'I feel closest to you when…',
  'One thing I never want us to stop doing is…',
  'A dream I have for us is…',
];

export const EMOJI_STORIES = [
  { prompt: '🌧️🍕🎬❤️', answer: 'Rainy pizza movie night' },
  { prompt: '☕🛋️📖🐶', answer: 'Cozy coffee, books, and the dog' },
  { prompt: '✈️🗺️🍜📸', answer: 'Travel day with food and photos' },
  { prompt: '🌅🥾💧👫', answer: 'Sunrise hike together' },
  { prompt: '🕯️🍝🎶🥂', answer: 'Candlelit dinner at home' },
];

export const LOVE_QUIZ = [
  { question: 'My favorite food?', hint: 'One partner answers — the other guesses' },
  { question: 'My dream vacation?', hint: 'Be specific if you can' },
  { question: 'Coffee or tea?', hint: 'Or neither!' },
  { question: "What's my biggest fear?", hint: 'Go gentle' },
  { question: "What's my love language?", hint: 'Words, time, gifts, acts, or touch' },
  { question: 'My go-to comfort show?', hint: 'Bonus if you know the episode' },
  { question: 'What always makes me laugh?', hint: 'Inside jokes count' },
  { question: 'My ideal Sunday?', hint: 'Morning to night' },
];

export const APPRECIATION_PROMPTS = [
  'Tell your partner one thing you’re grateful for today.',
  'Name one small thing they did recently that you noticed.',
  'Share one way they make ordinary days better.',
  'Thank them for something they always do without being asked.',
];

export const THIRTY_SIX_QUESTIONS = [
  'Given the choice of anyone in the world, whom would you want as a dinner guest?',
  'Would you like to be famous? In what way?',
  'Before making a telephone call, do you ever rehearse what you are going to say?',
  'What would constitute a “perfect” day for you?',
  'When did you last sing to yourself? To someone else?',
  'If you were able to live to the age of 90 and retain either the mind or body of a 30-year-old for the last 60 years of your life, which would you want?',
  'Do you have a secret hunch about how you will die?',
  'Name three things you and your partner appear to have in common.',
  'For what in your life do you feel most grateful?',
  'If you could change anything about the way you were raised, what would it be?',
  'Take four minutes and tell your partner your life story in as much detail as possible.',
  'If you could wake up tomorrow having gained any one quality or ability, what would it be?',
];

export const WEEK_CHALLENGE = [
  { day: 1, title: 'Hug every day', detail: 'At least one real hug — no phones.' },
  { day: 2, title: 'Take one photo', detail: 'Capture a small moment together.' },
  { day: 3, title: 'Share your mood', detail: 'Send how you actually feel today.' },
  { day: 4, title: 'Send one compliment', detail: 'Specific beats generic.' },
  { day: 5, title: 'Ask one curious question', detail: 'Something you don’t already know.' },
  { day: 6, title: 'Plan something tiny', detail: 'Coffee, a walk, or a snack date.' },
  { day: 7, title: 'Look back together', detail: 'Talk about your favorite moment this week.' },
];

export const DATE_NIGHT_CHALLENGE = [
  { title: 'Cook together', detail: 'One meal, no takeout.' },
  { title: 'Watch a sunset', detail: 'Phones down for ten minutes.' },
  { title: 'No phones tonight', detail: 'Put them in another room.' },
  { title: 'Try something new', detail: 'A place, dish, or activity neither has done.' },
];

export const FORTUNE_WHEEL = [
  'Kiss',
  'Compliment',
  'Hug',
  'Plan a date',
  'Tell a joke',
  'Share a favorite memory',
  'Send a voice note',
  'Dance for 30 seconds',
];

export const COMPATIBILITY_QUESTIONS = [
  {
    question: 'On a free Saturday you usually want to…',
    options: [
      { label: 'Stay in and recharge', value: 'home' },
      { label: 'Go out and explore', value: 'adventure' },
      { label: 'A mix — short outing then couch', value: 'balance' },
    ],
  },
  {
    question: 'When money is tight, you prefer to…',
    options: [
      { label: 'Save first, spend later', value: 'save' },
      { label: 'Spend on experiences', value: 'experience' },
      { label: 'Talk it through every time', value: 'talk' },
    ],
  },
  {
    question: 'During conflict you tend to…',
    options: [
      { label: 'Need space first', value: 'space' },
      { label: 'Want to talk it out now', value: 'talk' },
      { label: 'Joke to lighten the mood', value: 'humor' },
    ],
  },
];

export const PERSONALITY_QUESTIONS = [
  {
    question: 'At a party you usually…',
    options: [
      { label: 'Find one deep conversation', value: 'depth' },
      { label: 'Float between groups', value: 'social' },
      { label: 'Stick with your person', value: 'pair' },
      { label: 'Leave early for quiet', value: 'recharge' },
    ],
  },
  {
    question: 'Your ideal weekend plans are…',
    options: [
      { label: 'Fully scheduled', value: 'planner' },
      { label: 'A loose idea, then vibe', value: 'flexible' },
      { label: 'Zero plans until the day', value: 'spontaneous' },
    ],
  },
  {
    question: 'When making a big decision you…',
    options: [
      { label: 'List pros and cons', value: 'logic' },
      { label: 'Go with your gut', value: 'feel' },
      { label: 'Ask people you trust', value: 'advise' },
    ],
  },
  {
    question: 'Under stress you show it by…',
    options: [
      { label: 'Getting quiet', value: 'quiet' },
      { label: 'Talking it out', value: 'talk' },
      { label: 'Getting busy / productive', value: 'busy' },
      { label: 'Needing comfort first', value: 'comfort' },
    ],
  },
  {
    question: 'Your love language in one word feels closest to…',
    options: [
      { label: 'Words', value: 'words' },
      { label: 'Time', value: 'time' },
      { label: 'Touch', value: 'touch' },
      { label: 'Acts', value: 'acts' },
      { label: 'Gifts', value: 'gifts' },
    ],
  },
];

export const ATTACHMENT_QUESTIONS = [
  {
    question: 'When your partner needs alone time you usually…',
    options: [
      { label: 'Feel fine — I get it', value: 'secure' },
      { label: 'Worry they’re pulling away', value: 'anxious' },
      { label: 'Feel relieved — I like space too', value: 'avoidant' },
    ],
  },
  {
    question: 'You feel closest when…',
    options: [
      { label: 'We check in and stay connected', value: 'secure' },
      { label: 'I get lots of reassurance', value: 'anxious' },
      { label: 'We’re close without needing constant talk', value: 'avoidant' },
    ],
  },
  {
    question: 'After a disagreement you tend to…',
    options: [
      { label: 'Repair and move forward', value: 'secure' },
      { label: 'Replay it and need closure soon', value: 'anxious' },
      { label: 'Shut down until it cools off', value: 'avoidant' },
    ],
  },
  {
    question: 'Texts going unanswered for a few hours…',
    options: [
      { label: 'Usually no big deal', value: 'secure' },
      { label: 'Makes me spiral a bit', value: 'anxious' },
      { label: 'I barely notice', value: 'avoidant' },
    ],
  },
  {
    question: 'In a relationship you most need…',
    options: [
      { label: 'Trust and steady warmth', value: 'secure' },
      { label: 'Frequent closeness and clarity', value: 'anxious' },
      { label: 'Independence and breathing room', value: 'avoidant' },
    ],
  },
];

export function pickFortune() {
  return FORTUNE_WHEEL[Math.floor(Math.random() * FORTUNE_WHEEL.length)];
}

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

export const DAILY_QUESTIONS = [
  'What made you smile about us today?',
  'What is one small thing I did that you noticed?',
  'If we had a free hour right now, what would you want to do?',
  'What are you looking forward to with me this week?',
  'What song or moment today reminded you of us?',
  'What is something new you would like to try together?',
  'When did you last feel proud of us?',
  'What is your favorite way we reconnect after a busy day?',
  'What would make tonight feel special?',
  'What is one thing you are grateful for about our relationship?',
  'If you could relive one day with me, which would it be?',
  'What is a habit of mine you secretly love?',
  'What adventure should we plan next?',
  'What do you need more of from me right now?',
  'What made you feel loved recently?',
];

export const COUPLES_TRIVIA = [
  {
    question: 'What matters most in a strong relationship?',
    options: ['Perfect agreement on everything', 'Trust and communication', 'Matching hobbies only', 'Never arguing'],
    answer: 1,
  },
  {
    question: 'The best way to show appreciation is often…',
    options: ['Grand expensive gestures only', 'Noticing the small things', 'Keeping score', 'Waiting for them to ask'],
    answer: 1,
  },
  {
    question: 'Quality time means…',
    options: ['Being in the same room on phones', 'Undivided attention together', 'Only going on dates', 'Talking about work only'],
    answer: 1,
  },
  {
    question: 'When you disagree, the healthiest move is usually…',
    options: ['Win the argument', 'Pause and listen first', 'Bring up old issues', 'Go silent for days'],
    answer: 1,
  },
  {
    question: 'A great date night can be…',
    options: ['Only fancy restaurants', 'Anything intentional together', 'Always outdoors', 'Always a surprise'],
    answer: 1,
  },
  {
    question: 'Couples who last often prioritize…',
    options: ['Being right', 'Repairing after conflict', 'Avoiding hard topics', 'Changing each other'],
    answer: 1,
  },
];

export function getDailyQuestion(date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  return DAILY_QUESTIONS[day % DAILY_QUESTIONS.length];
}

export function pickRandomDateIdea() {
  return DATE_IDEAS[Math.floor(Math.random() * DATE_IDEAS.length)];
}

export const TRUTH_OR_DARE = {
  truths: [
    'What is something you have never told me but want to?',
    'When did you first know you liked me?',
    'What is your favorite memory of us?',
    'What do you think our superpower as a couple is?',
    'What is one thing I do that always makes you smile?',
  ],
  dares: [
    'Send them a voice note saying three things you love about them',
    'Plan a surprise snack or drink for them in the next hour',
    'Do your best impression of them — lovingly',
    'Pick a song that describes them and play the chorus',
    'Give them a 30-second shoulder massage',
  ],
};

export const MEMORY_QUIZ = [
  {
    question: 'Where was your first date together?',
    hint: 'Compare answers — the story matters more than being exact',
  },
  {
    question: 'What food do you always order together?',
    hint: 'Bonus points if you both say the same thing',
  },
  {
    question: 'What is a trip or day out you still talk about?',
    hint: 'Share why it stuck with you',
  },
  {
    question: 'What song feels most like “us”?',
    hint: 'Hum a line if you dare',
  },
  {
    question: 'What is the best gift you have given each other?',
    hint: 'Big or small counts',
  },
];

export const PLAYLIST_PROMPTS = [
  'A song that reminds you of them today',
  'Your go-to road-trip anthem together',
  'A track that was playing during a favorite memory',
  'Something mellow for a cozy night in',
  'A song that hypes you up for a date night',
  'The song you would dedicate to them right now',
];

export function pickTruthOrDare(mode: 'truth' | 'dare') {
  const pool = mode === 'truth' ? TRUTH_OR_DARE.truths : TRUTH_OR_DARE.dares;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickPlaylistPrompt() {
  return PLAYLIST_PROMPTS[Math.floor(Math.random() * PLAYLIST_PROMPTS.length)];
}

export function getNextFridayEvening(from = new Date()) {
  const d = new Date(from);
  const day = d.getDay();
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilFriday);
  d.setHours(19, 0, 0, 0);
  return d;
}

export { getAnniversaryCountdown } from '@/lib/anniversary';

