import type { GameItem, LiveGameKind, TruthDarePool, Vibe } from './types';

/** Local content banks: the offline / AI-failure fallback so a room always has something to play. */

export function shuffle<T>(list: T[], rand: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const WYR: Record<Vibe, [string, string][]> = {
  sweet: [
    ['Cook dinner together every night', 'Explore a new city together every month'],
    ['Relive our first date', 'Fast-forward to our 50th anniversary'],
    ['Slow dance in the kitchen', 'Stargaze from a rooftop'],
    ['Get a handwritten love letter', 'Get a playlist made just for you'],
    ['A lazy Sunday in bed together', 'A spontaneous road trip'],
    ['Always hold hands in public', 'Always share one dessert'],
    ['Read each other’s thoughts for a day', 'Teleport to each other anytime'],
    ['Wake up to breakfast in bed', 'Fall asleep to a bedtime story'],
  ],
  playful: [
    ['Only talk in song lyrics for a day', 'Only talk in movie quotes for a day'],
    ['Fight one horse-sized duck', 'Fight 100 duck-sized horses'],
    ['Have your life narrated like a nature documentary', 'Have a theme song play whenever you enter a room'],
    ['Swap wardrobes for a week', 'Swap phones for a day'],
    ['Always have to whisper', 'Always have to shout'],
    ['Live in a treehouse', 'Live on a houseboat'],
    ['Never use emojis again', 'Only ever communicate in emojis'],
    ['Unlimited pizza forever', 'Unlimited tacos forever'],
  ],
  spicy: [
    ['A surprise kiss in public', 'A love note hidden in your pocket'],
    ['Be blindfolded and led on a mystery date', 'Plan a full romantic evening for them'],
    ['Slow dance at midnight', 'Late-night drive with no destination'],
    ['Give a 10-minute massage', 'Get a 10-minute massage'],
    ['Text them something flirty right now', 'Whisper something flirty later'],
    ['Recreate your first kiss', 'Recreate your first date outfit'],
    ['Candlelit dinner at home', 'Candlelit bath side by side'],
    ['Sleep in their hoodie', 'Have them sleep in yours'],
  ],
  deep: [
    ['Know every thought your partner has about you', 'Have them know every thought you have about them'],
    ['Live somewhere beautiful but far from family', 'Live near everyone you love in an ordinary place'],
    ['Be remembered for kindness', 'Be remembered for achievement'],
    ['A deeply honest talk every week', 'A surprise adventure every week'],
    ['Rewrite one moment of your past', 'Relive one perfect day'],
    ['Hear a hard truth gently', 'Be spared it and never know'],
    ['Grow old in a cozy little house', 'Grow old traveling the world'],
    ['Share every dream you have', 'Keep one dream just for yourself'],
  ],
};

const THIS_OR_THAT: [string, string][] = [
  ['Coffee', 'Tea'],
  ['Beach', 'Mountains'],
  ['Sunrise', 'Sunset'],
  ['Cook in', 'Eat out'],
  ['Movie night', 'Game night'],
  ['Sweet', 'Salty'],
  ['Text', 'Call'],
  ['Morning person', 'Night owl'],
  ['Hot summer', 'Cozy winter'],
  ['Cats', 'Dogs'],
  ['Road trip', 'Flight'],
  ['Pancakes', 'Waffles'],
  ['Spontaneous', 'Planned'],
  ['Big party', 'Small dinner'],
  ['Hugs', 'Kisses'],
  ['Books', 'Podcasts'],
  ['City break', 'Cabin retreat'],
  ['Pizza', 'Sushi'],
  ['Candlelight', 'Fairy lights'],
  ['Slow dance', 'Living-room dance party'],
];

const WHOS_LIKELY: Record<Vibe, string[]> = {
  sweet: [
    'cry at a movie',
    'remember our anniversary first',
    'plan a surprise',
    'say “I love you” first',
    'give the best hugs',
    'write a love letter',
    'fall asleep during a movie',
    'tear up at a wedding',
  ],
  playful: [
    'get lost with GPS on',
    'become famous',
    'eat the last slice without asking',
    'adopt a pet impulsively',
    'trip in public',
    'laugh at the wrong moment',
    'talk to strangers on a plane',
    'win an argument by being loud',
  ],
  spicy: [
    'flirt with someone by accident',
    'start a kiss in public',
    'steal the covers',
    'send a risky text',
    'blush first',
    'plan a romantic surprise',
    'dress up for date night',
    'make the first move',
  ],
  deep: [
    'overthink things',
    'apologize first',
    'hold a grudge',
    'keep a secret forever',
    'take a big risk',
    'say what they really feel',
    'dream the biggest',
    'stay calm in a crisis',
  ],
};

const TRUTHS: Record<Vibe, string[]> = {
  sweet: [
    'What’s your favorite memory of us?',
    'When did you first realize you liked me?',
    'What’s one thing I do that always makes you smile?',
    'What small habit of mine do you secretly love?',
    'What’s a dream you haven’t told me about yet?',
    'What’s your favorite thing about our routine?',
  ],
  playful: [
    'What’s the silliest thing you’ve googled lately?',
    'What’s your most embarrassing moment?',
    'What habit of yours would annoy you in a partner?',
    'Which celebrity would you swap lives with?',
    'What’s a lie you told that you still remember?',
    'What’s the weirdest dream you’ve had about me?',
  ],
  spicy: [
    'What’s the first thing you noticed about me?',
    'What’s your favorite way for me to kiss you?',
    'Where would you love to be surprised with a romantic date?',
    'Which outfit of mine do you love most?',
    'What’s your favorite thing about our chemistry?',
    'What’s a fantasy date you’ve never suggested?',
  ],
  deep: [
    'What are you most afraid of losing?',
    'What do you need more of from me?',
    'When do you feel closest to me?',
    'What’s something you’re still healing from?',
    'What’s a promise you want us to make?',
    'What does “home” mean to you?',
  ],
};

const DARES: Record<Vibe, string[]> = {
  sweet: [
    'Give me your best compliment in 20 seconds',
    'Say three things you adore about me without pausing',
    'Do your best impression of me',
    'Blow me a kiss and describe our best day',
    'Hum our song until I guess it',
    'Describe our first date in exactly three sentences',
  ],
  playful: [
    'Speak in an accent until your next turn',
    'Do 10 jumping jacks while singing the alphabet',
    'Narrate what you’re doing like a sports commentator for 30 seconds',
    'Make up a song about me right now',
    'Do your best impression of a cat',
    'Talk in third person until the next round',
  ],
  spicy: [
    'Whisper your favorite thing about me',
    'Describe our best kiss in vivid detail',
    'Send me the flirtiest text you can in 60 seconds',
    'Give me your best sultry “good night” voice',
    'Tell me what you’d do if we were together right now (keep it tasteful)',
    'Tell me something irresistible about me in a low voice',
  ],
  deep: [
    'Share a memory that shaped who you are',
    'Say what you’re grateful for about us for 30 seconds straight',
    'Tell me one thing you admire about how I handle hard things',
    'Read me one sentence of a future letter to us',
    'Share a fear and let me hold it with you',
    'Describe us in five years',
  ],
};

const GUESS_PROMPTS: string[] = [
  'What’s my go-to comfort food?',
  'What’s my dream vacation?',
  'What song do I sing in the shower?',
  'What’s my biggest pet peeve?',
  'What would I grab first in a fire (besides you)?',
  'What’s my most-used emoji?',
  'What did I want to be as a kid?',
  'What’s my favorite thing to do on a rainy day?',
  'What’s my hidden talent?',
  'What would I order at a fancy restaurant?',
  'What do I do when I’m stressed?',
  'What’s the first thing I’d buy if I won the lottery?',
];

const QUIZ_BANK: { question: string; options: string[]; correctIndex: number }[] = [
  { question: 'Which is the largest ocean?', options: ['Atlantic', 'Pacific', 'Indian', 'Arctic'], correctIndex: 1 },
  { question: 'How many hearts does an octopus have?', options: ['1', '2', '3', '4'], correctIndex: 2 },
  { question: 'What flower is the classic symbol of love?', options: ['Tulip', 'Rose', 'Daisy', 'Orchid'], correctIndex: 1 },
  { question: 'What is the hardest natural substance?', options: ['Gold', 'Iron', 'Diamond', 'Quartz'], correctIndex: 2 },
  { question: 'In which city is the Colosseum?', options: ['Athens', 'Rome', 'Madrid', 'Paris'], correctIndex: 1 },
  { question: 'True or false: honey never spoils.', options: ['True', 'False'], correctIndex: 0 },
  { question: 'Which hormone is nicknamed the “love hormone”?', options: ['Insulin', 'Oxytocin', 'Cortisol', 'Adrenaline'], correctIndex: 1 },
  { question: 'How many continents are there?', options: ['5', '6', '7', '8'], correctIndex: 2 },
  { question: 'True or false: lightning never strikes the same place twice.', options: ['True', 'False'], correctIndex: 1 },
  { question: 'What is the capital of Japan?', options: ['Kyoto', 'Osaka', 'Tokyo', 'Nagoya'], correctIndex: 2 },
  { question: 'Which gas do plants absorb from the air?', options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Helium'], correctIndex: 1 },
  { question: 'Which bird is a classic symbol of lifelong romance?', options: ['Swan', 'Chicken', 'Pigeon', 'Turkey'], correctIndex: 0 },
];

function take<T>(list: T[], count: number, rand?: () => number): T[] {
  if (list.length === 0) return [];
  const shuffled = shuffle(list, rand);
  const out: T[] = [];
  while (out.length < count) out.push(...shuffled.slice(0, count - out.length));
  return out;
}

export interface LocalContent {
  items: GameItem[];
  pool: TruthDarePool | null;
}

export function localContent(
  game: LiveGameKind,
  vibe: Vibe,
  count: number,
  rand?: () => number,
): LocalContent {
  switch (game) {
    case 'wouldYouRather': {
      const own = WYR[vibe];
      const others = Object.values(WYR).flat().filter((p) => !own.includes(p));
      const pairs = [...take(own, Math.min(count, own.length), rand), ...take(others, count, rand)].slice(0, count);
      return { items: pairs.map(([a, b]) => ({ kind: 'choice', a, b })), pool: null };
    }
    case 'thisOrThat':
      return {
        items: take(THIS_OR_THAT, count, rand).map(([a, b]) => ({ kind: 'choice', a, b })),
        pool: null,
      };
    case 'whosLikely': {
      const own = WHOS_LIKELY[vibe];
      const others = Object.values(WHOS_LIKELY).flat().filter((t) => !own.includes(t));
      const texts = [...take(own, Math.min(count, own.length), rand), ...take(others, count, rand)].slice(0, count);
      return { items: texts.map((text) => ({ kind: 'prompt', text: `Who’s more likely to ${text}?` })), pool: null };
    }
    case 'truthDare':
      return {
        items: [],
        pool: {
          truth: shuffle(TRUTHS[vibe], rand),
          dare: shuffle(DARES[vibe], rand),
        },
      };
    case 'guessAnswer':
      return {
        items: take(GUESS_PROMPTS, count, rand).map((text) => ({ kind: 'prompt', text })),
        pool: null,
      };
    case 'twoTruths':
      return { items: [], pool: null };
    case 'quiz':
      return {
        items: take(QUIZ_BANK, count, rand).map((q) => ({ kind: 'quiz', ...q })),
        pool: null,
      };
  }
}

/** Light validation so a malformed AI response can never crash a live room. */
export function sanitizeContent(
  game: LiveGameKind,
  raw: unknown,
): LocalContent | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const str = (v: unknown, max = 160) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  if (game === 'truthDare') {
    const pool = data.pool as Record<string, unknown> | undefined;
    const truth = Array.isArray(pool?.truth) ? pool.truth.map((t) => str(t)).filter(Boolean) : [];
    const dare = Array.isArray(pool?.dare) ? pool.dare.map((t) => str(t)).filter(Boolean) : [];
    return truth.length >= 2 && dare.length >= 2 ? { items: [], pool: { truth, dare } } : null;
  }

  if (game === 'twoTruths') return { items: [], pool: null };

  const list = Array.isArray(data.items) ? data.items : [];
  const items: GameItem[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (game === 'wouldYouRather' || game === 'thisOrThat') {
      const a = str(e.a, 90);
      const b = str(e.b, 90);
      if (a && b) items.push({ kind: 'choice', a, b });
    } else if (game === 'whosLikely' || game === 'guessAnswer') {
      const text = str(e.text);
      if (text) items.push({ kind: 'prompt', text });
    } else if (game === 'quiz') {
      const question = str(e.question, 200);
      const options = Array.isArray(e.options) ? e.options.map((o) => str(o, 80)).filter(Boolean) : [];
      const idx = typeof e.correctIndex === 'number' ? e.correctIndex : undefined;
      if (question && options.length >= 2 && options.length <= 4) {
        items.push({
          kind: 'quiz',
          question,
          options,
          correctIndex: idx !== undefined && idx >= 0 && idx < options.length ? idx : undefined,
        });
      }
    }
  }
  return items.length >= 3 ? { items, pool: null } : null;
}
