import type { ActivityArtId } from '@/components/activities/explore/ActivityArt';
import type { AreaId, Depth, HandpickedFormat, PackQuestion } from '@/lib/handpicked';

/**
 * Quizzes, talk-about cards and things to do together for every area. They all play
 * through the pack screen: answer on your own, then see each other's answers.
 * - Quiz: tap a pick; matching picks score.
 * - This or that: a quiz with two picks.
 * - Cards: an open question to answer or talk through.
 * - Together: something to go and do, ticked off with how it went.
 */

export interface FormatPackDef {
  id: string;
  area: AreaId;
  title: string;
  depth: Depth;
  blurb: string;
  art?: ActivityArtId;
  format: Exclude<HandpickedFormat, 'questions'>;
  questions: PackQuestion[];
}

/** How a "Together" task went; a written note is optional on top. */
export const TOGETHER_PICKS = ['Loved it', 'It was nice', 'Want to do it again', 'Not really us'];

const quiz = (
  id: string,
  area: AreaId,
  title: string,
  depth: Depth,
  blurb: string,
  items: [string, string[]][],
): FormatPackDef => ({
  id,
  area,
  title,
  depth,
  blurb,
  art: 'loveQuiz',
  format: 'quizzes',
  questions: items.map(([text, picks], i) => ({ id: String(i + 1), text, picks })),
});

const thisOrThat = (id: string, area: AreaId, title: string, blurb: string, pairs: [string, string][]): FormatPackDef => ({
  id,
  area,
  title,
  depth: 'light',
  blurb,
  art: 'thisOrThat',
  format: 'quizzes',
  questions: pairs.map(([a, b], i) => ({ id: String(i + 1), text: `${a} or ${b.toLowerCase()}?`, picks: [a, b] })),
});

const cards = (id: string, area: AreaId, title: string, depth: Depth, blurb: string, texts: string[]): FormatPackDef => ({
  id,
  area,
  title,
  depth,
  blurb,
  art: 'cards',
  format: 'prompts',
  questions: texts.map((text, i) => ({ id: String(i + 1), text })),
});

const together = (id: string, area: AreaId, title: string, depth: Depth, blurb: string, texts: string[]): FormatPackDef => ({
  id,
  area,
  title,
  depth,
  blurb,
  art: 'challenge',
  format: 'activities',
  questions: texts.map((text, i) => ({ id: String(i + 1), text, picks: TOGETHER_PICKS })),
});

export const FORMAT_PACKS: FormatPackDef[] = [
  // ── Getting to know you ────────────────────────────────────────────────
  quiz('knowing-quiz-me', 'knowing', 'How well do you know me?', 'light', 'Answer for yourself. See how many you match.', [
    ['Perfect Sunday morning?', ['Sleep in', 'Long breakfast', 'Workout', 'Out early']],
    ['Go-to comfort food?', ['Pizza', 'Noodles', 'Something sweet', 'Home cooking']],
    ['Best way to unwind?', ['A show', 'Music', 'Going out', 'Total silence']],
    ['Dream holiday?', ['Beach', 'City break', 'Mountains', 'Road trip']],
    ['Morning person or night owl?', ['Morning', 'Night', 'Neither', 'Depends on the day']],
    ['Favourite season?', ['Spring', 'Summer', 'Autumn', 'Winter']],
  ]),
  thisOrThat('knowing-tot', 'knowing', 'This or that: everyday', 'Quick picks. Fast, fun, surprisingly telling.', [
    ['Coffee', 'Tea'],
    ['Call', 'Text'],
    ['Cats', 'Dogs'],
    ['Sunrise', 'Sunset'],
    ['Sweet', 'Savoury'],
    ['Book', 'Movie'],
    ['Plan everything', 'Go with the flow'],
    ['Big party', 'Small dinner'],
  ]),
  cards('knowing-cards', 'knowing', 'Get curious', 'real', 'Cards that go one layer past small talk.', [
    'What’s something you’ve changed your mind about in the last year?',
    'What’s a small thing that instantly makes your day better?',
    'Which song takes you straight back to being a teenager?',
    'What’s a skill you’d love to have without the practice?',
    'Who outside our relationship shaped you the most?',
    'What’s something people often get wrong about you?',
    'What’s a compliment you still remember?',
    'What would you do with a completely free week?',
  ]),
  together('knowing-do', 'knowing', 'Learn each other', 'light', 'Little missions to discover something new.', [
    'Swap phones and show each other your five most-played songs.',
    'Cook a dish from the other’s childhood.',
    'Teach each other one thing you’re good at in 15 minutes.',
    'Take each other to a favourite place you’ve never shared.',
    'Look through old photos of each other and ask about three.',
    'Write down three facts about yourself the other might not know, then swap.',
  ]),

  // ── Our story ──────────────────────────────────────────────────────────
  quiz('story-quiz', 'story', 'Our story quiz', 'light', 'Do you remember it the same way?', [
    ['Who made the first move?', ['Me', 'You', 'It was mutual', 'Still debated']],
    ['Our first date was…', ['Perfect', 'Awkward but cute', 'A disaster', 'Not even a date']],
    ['Who said “I love you” first?', ['Me', 'You', 'Same moment', 'Can’t remember']],
    ['Our first trip together was…', ['Amazing', 'Chaotic', 'Too short', 'Still to come']],
    ['Our song is…', ['Obvious', 'A secret', 'We need one', 'A few songs']],
    ['When did it feel serious?', ['First month', 'First few months', 'After a year', 'Slowly, then suddenly']],
  ]),
  thisOrThat('story-tot', 'story', 'This or that: our firsts', 'Pick the memory that wins.', [
    ['First date', 'First kiss'],
    ['First trip', 'First home'],
    ['First fight', 'First make-up'],
    ['Old photos', 'Old messages'],
    ['How we met', 'How we fell'],
    ['Anniversary dinner', 'Anniversary trip'],
  ]),
  cards('story-cards', 'story', 'Remember when', 'real', 'Retell the moments that made you, you.', [
    'What’s a moment with me you’d love to relive?',
    'When did you first feel at home with me?',
    'What’s the funniest thing that’s happened to us?',
    'What’s a hard time we got through that made us stronger?',
    'Which photo of us best sums us up?',
    'What did we do on our best ever day together?',
    'What was the moment you knew you could trust me?',
  ]),
  together('story-do', 'story', 'Make a memory', 'light', 'Little things to add to your story.', [
    'Recreate your first date, as close as you can.',
    'Print five photos of you two and put them up somewhere.',
    'Write a one-page “how we met” from each side and swap.',
    'Go back to the place you first met or first kissed.',
    'Make a playlist of the songs from your relationship so far.',
    'Start a jar of memories and add one each this week.',
  ]),

  // ── Fun ────────────────────────────────────────────────────────────────
  quiz('fun-quiz-likely', 'fun', 'Who’s more likely to…', 'light', 'Pick who. See if you agree.', [
    ['Get lost with a map open?', ['Me', 'You', 'Both of us', 'Neither']],
    ['Cry at a film?', ['Me', 'You', 'Both of us', 'Neither']],
    ['Eat the last slice?', ['Me', 'You', 'Both of us', 'Neither']],
    ['Start a random dance party?', ['Me', 'You', 'Both of us', 'Neither']],
    ['Win a game show?', ['Me', 'You', 'Both of us', 'Neither']],
    ['Survive a zombie apocalypse?', ['Me', 'You', 'Both of us', 'Neither']],
    ['Laugh at the wrong moment?', ['Me', 'You', 'Both of us', 'Neither']],
  ]),
  thisOrThat('fun-tot', 'fun', 'This or that: weekend', 'The weekend debate, settled.', [
    ['Arcade', 'Escape room'],
    ['Karaoke', 'Comedy show'],
    ['Picnic', 'Brunch'],
    ['Board games', 'Video games'],
    ['Theme park', 'Museum'],
    ['Pyjama day', 'Adventure day'],
    ['Cook at home', 'Order in'],
    ['Road trip', 'Staycation'],
  ]),
  cards('fun-cards', 'fun', 'Silly questions', 'light', 'Ridiculous questions with real answers.', [
    'If we were a band, what would we be called?',
    'Which fictional couple are we most like?',
    'What would your wrestling entrance song be?',
    'If you could only eat one food forever, what would it be?',
    'What’s the most useless talent you have?',
    'If animals could talk, which would be the rudest?',
    'What would our reality show be called?',
    'What’s your secret go-to karaoke song?',
  ]),
  together('fun-do', 'fun', 'Play date', 'light', 'Little bursts of fun to do this week.', [
    'Build a blanket fort and watch something inside it.',
    'Have a 10-minute dance party in the kitchen.',
    'Try a recipe neither of you has ever cooked.',
    'Play a board game you haven’t touched in years.',
    'Take silly photos in a photo booth or on a timer.',
    'Have a bake-off with a secret ingredient.',
    'Go on a walk and only take turns left or right by coin flip.',
  ]),

  // ── Romance ────────────────────────────────────────────────────────────
  quiz('romance-quiz', 'romance', 'Romance style quiz', 'light', 'What makes each of you swoon.', [
    ['The most romantic gesture is…', ['A handwritten note', 'A surprise plan', 'Undivided attention', 'A thoughtful gift']],
    ['Ideal date night?', ['Dinner out', 'Cosy night in', 'Something new', 'Dancing']],
    ['Flowers or…', ['Flowers', 'Chocolate', 'Experiences', 'Just you']],
    ['Best time for romance?', ['Morning', 'Afternoon', 'Evening', 'Late night']],
    ['Surprises are…', ['The best', 'Nice sometimes', 'Stressful', 'Only planned ones']],
    ['Public affection?', ['Love it', 'A little', 'Rather not', 'Depends where']],
  ]),
  thisOrThat('romance-tot', 'romance', 'This or that: date night', 'Decide your next date in eight taps.', [
    ['Candlelit dinner', 'Street food'],
    ['Slow dance', 'Stargazing'],
    ['Love letter', 'Voice note'],
    ['Rooftop drinks', 'Beach walk'],
    ['Surprise date', 'Planned date'],
    ['Breakfast in bed', 'Late night dessert'],
  ]),
  cards('romance-cards', 'romance', 'Keep the spark', 'real', 'Talk about what keeps it exciting.', [
    'What’s something I do that still gives you butterflies?',
    'What’s your favourite date we’ve ever had?',
    'What’s a romantic thing you’ve always wanted to do?',
    'When do you feel most attracted to me?',
    'What made you smile about me this week?',
    'What’s a song that makes you think of us?',
    'How do you like to be surprised?',
  ]),
  together('romance-do', 'romance', 'Romance missions', 'light', 'Small gestures, big feelings.', [
    'Leave a hidden love note for the other to find.',
    'Plan a surprise date and keep it secret until the day.',
    'Cook a candlelit dinner at home, phones away.',
    'Slow dance to a song you both love.',
    'Write each other a letter to open in a year.',
    'Watch the sunset together somewhere new.',
  ]),

  // ── Intimacy ───────────────────────────────────────────────────────────
  quiz('int-quiz', 'intimacy', 'Closeness quiz', 'real', 'How you each like to feel close.', [
    ['I feel most loved when…', ['You tell me', 'You help me', 'We spend time', 'You touch me']],
    ['Best kind of affection?', ['Hugs', 'Hand-holding', 'Cuddles', 'Kisses']],
    ['After a long day I want…', ['Space first', 'A hug right away', 'To talk', 'To be looked after']],
    ['Feeling wanted looks like…', ['Compliments', 'Flirting', 'Attention', 'Initiative']],
    ['Most intimate thing is…', ['Talking late', 'Lying together', 'Eye contact', 'Being silly together']],
  ]),
  thisOrThat('int-tot', 'intimacy', 'This or that: cosy', 'Little preferences that matter.', [
    ['Big spoon', 'Little spoon'],
    ['Back rub', 'Head scratch'],
    ['Morning cuddles', 'Night cuddles'],
    ['Soft music', 'Silence'],
    ['Whisper', 'Say it out loud'],
    ['Long hug', 'Quick kiss'],
  ]),
  cards('int-cards', 'intimacy', 'Closer', 'deep', 'Gentle cards for feeling close.', [
    'When do you feel closest to me?',
    'What kind of touch do you need more of?',
    'What makes you feel safe to be fully yourself with me?',
    'What’s something you’ve wanted to ask for but haven’t?',
    'How can I show I want you, in a way that lands?',
    'What’s a memory of us that still makes you blush?',
  ]),
  together('int-do', 'intimacy', 'Closeness rituals', 'real', 'Small rituals that build closeness.', [
    'Hold a hug for 20 seconds, every day this week.',
    'Spend 10 minutes looking at old photos while holding hands.',
    'Give each other a massage, no rushing.',
    'Go to bed at the same time three nights in a row.',
    'Take a bath or shower together with candles.',
    'Have a phone-free evening, just the two of you.',
  ]),

  // ── Communication ──────────────────────────────────────────────────────
  quiz('comm-quiz', 'communication', 'How we talk', 'real', 'Your styles side by side.', [
    ['When upset I usually…', ['Talk right away', 'Need time first', 'Write it down', 'Go quiet']],
    ['Best time for a serious talk?', ['Morning', 'Evening', 'On a walk', 'Over food']],
    ['When you vent, I should…', ['Just listen', 'Help fix it', 'Hug me', 'Ask questions']],
    ['I feel heard when you…', ['Repeat it back', 'Put your phone down', 'Ask follow-ups', 'Agree with me']],
    ['Texting style?', ['Long messages', 'Short and often', 'Voice notes', 'Emojis only']],
  ]),
  thisOrThat('comm-tot', 'communication', 'This or that: talking', 'How you each like to connect.', [
    ['Talk it out', 'Sleep on it'],
    ['Voice note', 'Text'],
    ['Deep talk', 'Light chat'],
    ['Advice', 'Listening ear'],
    ['Face to face', 'Side by side'],
    ['Say it now', 'Say it later'],
  ]),
  cards('comm-cards', 'communication', 'Say it better', 'real', 'Cards to practise talking and listening.', [
    'What’s one thing you wish I asked you about more?',
    'When did you last feel really listened to by me?',
    'What’s a phrase I say that you love hearing?',
    'What topic do we avoid that we should talk about?',
    'How can I tell when you need to talk?',
    'What helps you open up when you’re stuck?',
    'What’s a conversation we had that changed something?',
  ]),
  together('comm-do', 'communication', 'Talk tune-ups', 'light', 'Habits for better conversations.', [
    'Have a 10-minute check-in: high, low and one thing you need.',
    'Go on a phone-free walk and only ask questions.',
    'Each share one thing you appreciated today, every day this week.',
    'Practise repeating back what the other said before you reply.',
    'Write each other a short note about something hard to say.',
    'Ask “how are you really?” and wait for the full answer.',
  ]),

  // ── Trust ──────────────────────────────────────────────────────────────
  quiz('trust-quiz', 'trust', 'Trust check', 'real', 'What helps each of you feel secure.', [
    ['I feel most secure when…', ['You check in', 'You keep promises', 'You’re open', 'You include me']],
    ['Jealousy for me is…', ['Rare', 'Sometimes', 'Often', 'Depends']],
    ['Phone privacy?', ['Fully open', 'Mostly open', 'Private but fine', 'Private, please']],
    ['After a mistake I need…', ['An apology', 'A plan', 'Time', 'Reassurance']],
    ['Honesty means…', ['Telling everything', 'No lies', 'Sharing feelings', 'Being kind about it']],
  ]),
  thisOrThat('trust-tot', 'trust', 'This or that: honesty', 'Where you each stand.', [
    ['Hard truth', 'Kind silence'],
    ['Share passwords', 'Keep them'],
    ['Tell me now', 'Tell me later'],
    ['Reassurance', 'Space'],
    ['Over-explain', 'Short and sweet'],
  ]),
  cards('trust-cards', 'trust', 'Safe with you', 'deep', 'Cards for building security.', [
    'What makes you feel secure in us?',
    'Is there anything that makes you feel uneasy that we could talk about?',
    'What’s a promise you’d like us to make each other?',
    'When have I made you feel really safe?',
    'How do you like to be reassured?',
    'What’s something you’ve never told anyone but could tell me?',
  ]),
  together('trust-do', 'trust', 'Build trust', 'real', 'Small steps that add up.', [
    'Each share one fear about the relationship, and just listen.',
    'Make a small promise this week and keep it.',
    'Share one thing you’ve never told the other.',
    'Plan something together where each of you owns a part.',
    'Do a trust walk: one leads, one closes their eyes.',
  ]),

  // ── Conflict ───────────────────────────────────────────────────────────
  quiz('conflict-quiz', 'conflict', 'How we fight', 'real', 'Know your patterns, fight better.', [
    ['In a fight I tend to…', ['Get loud', 'Go quiet', 'Walk away', 'Over-explain']],
    ['I calm down by…', ['Being alone', 'Talking', 'Moving', 'Sleeping']],
    ['Best way to make up?', ['A sorry', 'A hug', 'A joke', 'A plan']],
    ['Our most common fight is about…', ['Time', 'Chores', 'Money', 'Little things']],
    ['I need a break of…', ['A few minutes', 'An hour', 'A night', 'No break']],
  ]),
  thisOrThat('conflict-tot', 'conflict', 'This or that: making up', 'How you each like to repair.', [
    ['Say sorry first', 'Wait a bit'],
    ['Hug it out', 'Talk it out'],
    ['Fix it now', 'Sleep on it'],
    ['Joke to break tension', 'Stay serious'],
    ['Write a note', 'Say it in person'],
  ]),
  cards('conflict-cards', 'conflict', 'Repair', 'deep', 'Cards for after a disagreement, or before one.', [
    'What helps you calm down during an argument?',
    'What’s something I do in fights that hurts more than I realise?',
    'What do you need to hear after we disagree?',
    'What’s an argument we keep having? What’s it really about?',
    'How can we signal “I need a break” kindly?',
    'What’s a fight we handled well?',
  ]),
  together('conflict-do', 'conflict', 'Fight fair', 'real', 'Practise the habits that help.', [
    'Agree on a code word for “let’s pause”.',
    'Each write down your top 3 rules for fair fights, then combine them.',
    'Talk through a past fight using “I felt…” instead of “you…”.',
    'Make a “make-up ritual” you’ll use next time.',
    'Spend 5 minutes each saying what you love about the other after a disagreement.',
  ]),

  // ── Long distance ──────────────────────────────────────────────────────
  quiz('distance-quiz', 'distance', 'Miles apart quiz', 'light', 'How you each stay close.', [
    ['Best way to stay close?', ['Video calls', 'Texting all day', 'Voice notes', 'Letters']],
    ['Hardest part of distance?', ['Time zones', 'No touch', 'Missing moments', 'Goodbyes']],
    ['Best visit plan?', ['Do everything', 'Do nothing', 'Mix of both', 'Somewhere new']],
    ['Call length?', ['Short and often', 'Long once a day', 'Fall asleep on call', 'Whenever']],
    ['Countdown to visits?', ['Love it', 'Makes it worse', 'Only near the end', 'Never thought about it']],
  ]),
  thisOrThat('distance-tot', 'distance', 'This or that: apart', 'Little preferences for the miles.', [
    ['Video call', 'Phone call'],
    ['Good morning text', 'Goodnight call'],
    ['Surprise parcel', 'Surprise visit'],
    ['Watch party', 'Game night online'],
    ['Letters', 'Voice notes'],
  ]),
  cards('distance-cards', 'distance', 'Close from afar', 'real', 'Talk about the miles honestly.', [
    'What’s the moment you miss me most in a day?',
    'What makes a call feel really good?',
    'What do you want to do first next time we see each other?',
    'What helps when you’re feeling lonely?',
    'Where do you see us closing the distance?',
    'What’s a small thing I can do from afar that means a lot?',
  ]),
  together('distance-do', 'distance', 'Long distance dates', 'light', 'Dates that work across the miles.', [
    'Watch the same film at the same time on a call.',
    'Cook the same recipe together over video.',
    'Send each other a care package with five little things.',
    'Go on a “walk together” on a call, describing what you see.',
    'Play an online game together for an evening.',
    'Write a letter by hand and post it.',
  ]),

  // ── Home life ──────────────────────────────────────────────────────────
  quiz('home-quiz', 'home', 'Home habits quiz', 'light', 'Who does what, really?', [
    ['Who’s tidier?', ['Me', 'You', 'Both of us', 'Neither']],
    ['Who cooks more?', ['Me', 'You', 'Equal', 'Takeaway does']],
    ['Ideal home vibe?', ['Cosy', 'Minimal', 'Colourful', 'Lived-in']],
    ['Worst chore?', ['Dishes', 'Laundry', 'Bathroom', 'Bins']],
    ['Thermostat?', ['Warm', 'Cool', 'Always fighting', 'Doesn’t matter']],
  ]),
  thisOrThat('home-tot', 'home', 'This or that: at home', 'Your perfect home, pick by pick.', [
    ['City flat', 'Country house'],
    ['Plants everywhere', 'No plants'],
    ['Quiet evenings', 'Friends over'],
    ['Make the bed', 'Leave it'],
    ['Cook together', 'Take turns'],
    ['Pet', 'No pet'],
  ]),
  cards('home-cards', 'home', 'Our home', 'real', 'Talk about the life you share day to day.', [
    'What makes a house feel like home to you?',
    'Which chore do you secretly not mind?',
    'What’s one routine you’d love us to start?',
    'How do you like to spend a quiet evening at home?',
    'What’s something at home that stresses you out?',
    'What’s your favourite spot in our place?',
  ]),
  together('home-do', 'home', 'Home projects', 'light', 'Make your space feel more like you.', [
    'Rearrange one room together.',
    'Plan and cook a full week of meals together.',
    'Each pick one chore to swap for a week.',
    'Make a cosy corner with blankets, lights and a plant.',
    'Have a Sunday reset: tidy, then treat yourselves.',
  ]),

  // ── Family ─────────────────────────────────────────────────────────────
  quiz('family-quiz', 'family', 'Family quiz', 'light', 'Families, holidays and traditions.', [
    ['Holidays with family?', ['Every year', 'Take turns', 'Just us', 'Mix it up']],
    ['How close are you to your family?', ['Very', 'Fairly', 'Distant', 'It’s complicated']],
    ['Family visits should be…', ['Long', 'Short', 'Often', 'Rare']],
    ['Favourite family tradition?', ['Food', 'Games', 'Trips', 'Celebrations']],
    ['Friends or family first?', ['Friends', 'Family', 'Equal', 'Depends']],
  ]),
  thisOrThat('family-tot', 'family', 'This or that: people', 'Your people, your way.', [
    ['Big gatherings', 'Small dinners'],
    ['Host', 'Be hosted'],
    ['New traditions', 'Old traditions'],
    ['Group trip', 'Couple trip'],
    ['Call often', 'Visit often'],
  ]),
  cards('family-cards', 'family', 'Roots', 'real', 'Where you come from and what you carry.', [
    'What’s a family tradition you want to keep?',
    'What’s something your family did that you want to do differently?',
    'Who in your family are you most like?',
    'What did holidays look like growing up?',
    'How can I support you with your family?',
    'What tradition would you like us to start?',
  ]),
  together('family-do', 'family', 'Your people', 'light', 'Bring your worlds together.', [
    'Host a dinner for friends or family.',
    'Call a grandparent or older relative and ask about their love story.',
    'Make a family recipe from each side.',
    'Start a new tradition for the next holiday.',
    'Create a photo album of both your families.',
  ]),

  // ── Money ──────────────────────────────────────────────────────────────
  quiz('money-quiz', 'money', 'Money style quiz', 'real', 'Saver, spender or somewhere in between?', [
    ['I’m more of a…', ['Saver', 'Spender', 'Planner', 'Go with it']],
    ['Best use of extra money?', ['Save it', 'Travel', 'Treat ourselves', 'Invest it']],
    ['Joint account?', ['Yes, everything', 'Some shared', 'Separate', 'Not sure']],
    ['Budgeting is…', ['Essential', 'Useful', 'Stressful', 'What’s a budget?']],
    ['Big purchase rule?', ['Always discuss', 'Over a set amount', 'Trust each other', 'Haven’t decided']],
  ]),
  thisOrThat('money-tot', 'money', 'This or that: spending', 'Where your money wants to go.', [
    ['Experiences', 'Things'],
    ['Save now', 'Enjoy now'],
    ['Cash', 'Card'],
    ['Splurge once', 'Small treats often'],
    ['Rent', 'Buy'],
  ]),
  cards('money-cards', 'money', 'Money talk', 'deep', 'Gentle cards for an awkward topic.', [
    'What did money feel like in your house growing up?',
    'What’s a purchase you’ll never regret?',
    'What would financial freedom look like for you?',
    'What money habit of mine do you admire?',
    'What’s one financial goal you’d like us to share?',
    'Is there anything about money that worries you?',
  ]),
  together('money-do', 'money', 'Money dates', 'real', 'Make money feel like teamwork.', [
    'Have a relaxed money date with a nice drink and your budgets.',
    'Pick one shared savings goal and name it.',
    'Have a no-spend weekend and plan free dates.',
    'List your subscriptions and cancel one together.',
    'Plan a dream trip and work out what it would cost.',
  ]),

  // ── Growth ─────────────────────────────────────────────────────────────
  quiz('growth-quiz', 'growth', 'Growth quiz', 'light', 'How you like to grow.', [
    ['I grow most from…', ['Challenges', 'Reading', 'People', 'Mistakes']],
    ['Support looks like…', ['Cheering', 'Pushing me', 'Giving space', 'Doing it with me']],
    ['New year resolution?', ['Always', 'Sometimes', 'Never', 'Secretly']],
    ['Best kind of feedback?', ['Straight', 'Gentle', 'Written', 'With a hug']],
    ['A goal I’d love this year…', ['Health', 'Career', 'Creative', 'Relationships']],
  ]),
  thisOrThat('growth-tot', 'growth', 'This or that: becoming', 'Small picks about who you’re becoming.', [
    ['Comfort zone', 'Stretch zone'],
    ['Journal', 'Talk it out'],
    ['Early start', 'Late finish'],
    ['Learn alone', 'Learn together'],
    ['Big goals', 'Small habits'],
  ]),
  cards('growth-cards', 'growth', 'Becoming', 'real', 'Cards about who you’re growing into.', [
    'What’s something you’re proud of from the last year?',
    'Where do you want to grow next?',
    'How have I helped you grow?',
    'What’s a habit you’d like to build?',
    'What’s something you’re learning about yourself?',
    'How can I cheer you on better?',
  ]),
  together('growth-do', 'growth', 'Grow together', 'real', 'Things to try side by side.', [
    'Start a 7-day habit together and check in every night.',
    'Take a class or online course together.',
    'Read the same book and talk about it.',
    'Each set one goal and one way the other can help.',
    'Try something that scares you both a little.',
  ]),

  // ── Future ─────────────────────────────────────────────────────────────
  quiz('future-quiz', 'future', 'Future us quiz', 'real', 'Where do you see yourselves?', [
    ['In five years we’ll be…', ['Same place', 'New city', 'New country', 'Who knows']],
    ['Dream home?', ['City flat', 'House with garden', 'By the sea', 'Countryside']],
    ['Kids?', ['Yes', 'Maybe', 'No', 'Already have them']],
    ['Retirement looks like…', ['Travelling', 'Gardening', 'Still working', 'Near family']],
    ['Biggest shared dream?', ['A home', 'Travel', 'A family', 'A business']],
  ]),
  thisOrThat('future-tot', 'future', 'This or that: someday', 'Dreams, two options at a time.', [
    ['Travel the world', 'Put down roots'],
    ['Big wedding', 'Small wedding'],
    ['City life', 'Quiet life'],
    ['Build a business', 'Steady job'],
    ['Many adventures', 'Many traditions'],
  ]),
  cards('future-cards', 'future', 'Someday', 'deep', 'Cards for the life you’re building.', [
    'What does a perfect ordinary day look like in ten years?',
    'What’s one thing you want us to have done by next year?',
    'Where would you live if anywhere was possible?',
    'What do you want to be remembered for?',
    'What’s a dream you haven’t said out loud yet?',
    'What do you hope never changes about us?',
  ]),
  together('future-do', 'future', 'Plan ahead', 'light', 'Turn dreams into plans.', [
    'Make a vision board for the next year together.',
    'Write ten things for your bucket list and pick one to plan.',
    'Write letters to future you, to open in five years.',
    'Plan your dream holiday down to the day.',
    'Set three goals for the next 90 days.',
  ]),
];
