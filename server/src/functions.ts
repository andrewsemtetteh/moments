import { checkAi, getPlusState, recordAi } from './billing';
import { ApiError, shapeRow } from './core';
import { generateId, isRelationshipMember } from './db';
import './env';

type RateLimiter = (env: Env, bucket: string, maxHits: number, windowSeconds: number) => Promise<void>;
/** Runs work after the response is sent (ExecutionContext.waitUntil). */
type Defer = (task: Promise<unknown>) => void;
type Bg = { limit: RateLimiter; defer: Defer };
type Body = Record<string, any>;

// ---------------------------------------------------------------------------
// AI helper: GPT-4o-mini when OPENAI_API_KEY is set (production), else Gemini 3.1 Flash-Lite (prototype)
// ---------------------------------------------------------------------------

async function askAi(env: Env, maxTokens: number, prompt: string, json = false): Promise<string | null> {
  try {
    if (env.OPENAI_API_KEY) return await askOpenAi(env.OPENAI_API_KEY, maxTokens, prompt);
    if (env.GEMINI_API_KEY) return await askGemini(env, env.GEMINI_API_KEY, maxTokens, prompt, json);
  } catch {
    /* callers fall back to built-in content */
  }
  return null;
}

async function askOpenAi(apiKey: string, maxTokens: number, prompt: string): Promise<string | null> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  return json.choices?.[0]?.message?.content ?? null;
}

// gemini-2.5-flash is closed to new API keys, so the default is Flash-Lite, which doesn't think by
// default. Full 3.x Flash models spend the output budget on thinking and return truncated answers.
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';

async function askGemini(env: Env, apiKey: string, maxTokens: number, prompt: string, jsonMode: boolean): Promise<string | null> {
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const generationConfig: Record<string, unknown> = { maxOutputTokens: maxTokens };
  // 2.5 models think by default and the thinking tokens count against maxOutputTokens.
  if (model.startsWith('gemini-2.5')) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  // JSON mode guarantees parseable output, so a batch is never wasted on a stray character.
  if (jsonMode) generationConfig.responseMimeType = 'application/json';
  const request = () =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig }),
    });
  let res = await request();
  // Gemini returns transient 503 "high demand" errors fairly often.
  if (res.status === 503 || res.status === 429) {
    await new Promise((r) => setTimeout(r, 800));
    res = await request();
  }
  if (!res.ok) return null;
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
  return text || null;
}

// ---------------------------------------------------------------------------
// Shared content bank
//
// The models are stateless, and generating per couple makes AI cost grow with every user. Instead,
// content is generated in batches into shared banks. Each couple keeps a cursor per bank, so nothing
// repeats for them; the AI is only called when a couple reaches the end of a bank, and that batch
// then serves every couple after them. Prompts stay a fixed size: only the bank's newest items are
// sent as "avoid these", and exact duplicates are rejected by the UNIQUE (bank, norm) index.
// ---------------------------------------------------------------------------

const DEFAULT_BATCH = 30;
/** Refill in the background once fewer than this many further servings remain for a couple. */
const LOW_WATER_SERVINGS = 2;
const AVOID_SAMPLE = 30;

const clean = (text: string, max: number) => text.replace(/\s+/g, ' ').trim().slice(0, max);
const normText = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (text: string) => normText(text).slice(0, 40).trim().replace(/ /g, '-');

type BankSpec<T> = {
  bank: string;
  maxTokens: number;
  /** Items per AI call; smaller for long items so a cold call stays well under the app's 12s timeout. */
  batch?: number;
  prompt: (count: number, avoid: string[]) => string;
  parse: (text: string | null) => T[];
  /** Readable text of an item: used for duplicate detection and the "avoid" list. */
  key: (item: T) => string;
};

function avoidList(avoid: string[]): string {
  if (!avoid.length) return '';
  return `\n\nAlready used. Do not repeat or closely reword any of these:\n${avoid.map((s) => `- ${clean(s, 140)}`).join('\n')}`;
}

function jsonArray(text: string | null): unknown[] {
  const match = text?.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readBank<T>(env: Env, bank: string, afterSeq: number, count: number): Promise<{ seq: number; item: T }[]> {
  const { results } = await env.DB.prepare(
    'SELECT seq, item FROM content_bank WHERE bank = ?1 AND seq > ?2 ORDER BY seq LIMIT ?3',
  )
    .bind(bank, afterSeq, count)
    .all<{ seq: number; item: string }>();
  return results.map((r) => ({ seq: r.seq, item: JSON.parse(r.item) as T }));
}

/** One AI call that appends up to BATCH_SIZE new items to a bank. */
async function fillBank<T>(env: Env, spec: BankSpec<T>, atLeast = 0): Promise<void> {
  const { results: recent } = await env.DB.prepare(
    'SELECT seq, item FROM content_bank WHERE bank = ?1 ORDER BY seq DESC LIMIT ?2',
  )
    .bind(spec.bank, AVOID_SAMPLE)
    .all<{ seq: number; item: string }>();
  const maxSeq = recent[0]?.seq ?? 0;
  const avoid = recent.map((r) => spec.key(JSON.parse(r.item) as T));

  const items = spec.parse(await askAi(env, spec.maxTokens, spec.prompt(Math.max(spec.batch ?? DEFAULT_BATCH, atLeast), avoid), true));
  if (!items.length) {
    console.warn(`content bank fill produced nothing: ${spec.bank}`);
    return;
  }
  const seen = new Set<string>();
  const inserts: D1PreparedStatement[] = [];
  for (const item of items) {
    const norm = normText(spec.key(item));
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    inserts.push(
      env.DB.prepare('INSERT OR IGNORE INTO content_bank (bank, seq, item, norm) VALUES (?1, ?2, ?3, ?4)').bind(
        spec.bank,
        maxSeq + inserts.length + 1,
        JSON.stringify(item),
        norm,
      ),
    );
  }
  if (inserts.length) await env.DB.batch(inserts);
}

/** Starts a fill after the response, at most once a minute per bank so a crowd can't trigger duplicate AI calls. */
function refillLater<T>(env: Env, spec: BankSpec<T>, bg: Bg, atLeast = 0) {
  bg.defer(
    (async () => {
      try {
        await bg.limit(env, `fill:${spec.bank}`, 1, 60);
      } catch {
        return;
      }
      await fillBank(env, spec, atLeast);
    })().catch(() => {}),
  );
}

/**
 * The next `count` items this couple hasn't seen. Never waits on the AI: when the bank runs low it is
 * refilled in the background, and an exhausted bank returns what's left (the app tops up locally).
 */
async function serveFromBank<T>(env: Env, relationshipId: string, spec: BankSpec<T>, count: number, bg: Bg): Promise<T[]> {
  const cursor = await env.DB.prepare('SELECT seq FROM content_cursor WHERE relationship_id = ?1 AND bank = ?2')
    .bind(relationshipId, spec.bank)
    .first<{ seq: number }>();
  const after = cursor?.seq ?? 0;

  const lookahead = await readBank<T>(env, spec.bank, after, count * (1 + LOW_WATER_SERVINGS));
  if (lookahead.length < count * (1 + LOW_WATER_SERVINGS)) refillLater(env, spec, bg, count);
  const rows = lookahead.slice(0, count);
  if (!rows.length) return [];

  await env.DB.prepare(
    `INSERT INTO content_cursor (relationship_id, bank, seq) VALUES (?1, ?2, ?3)
     ON CONFLICT (relationship_id, bank) DO UPDATE SET seq = MAX(content_cursor.seq, excluded.seq)`,
  )
    .bind(relationshipId, spec.bank, rows[rows.length - 1].seq)
    .run();
  return rows.map((r) => r.item);
}

const stringList = (max: number) => (text: string | null) =>
  jsonArray(text)
    .filter((s): s is string => typeof s === 'string')
    .map((s) => clean(s, max))
    .filter(Boolean);

/** AI games are a Plus feature. Pre-generated bank content isn't metered: serving it costs nothing. */
async function requirePlus(env: Env, relationshipId: string) {
  if (!(await getPlusState(env, relationshipId)).plus) {
    throw new ApiError('Moments Plus is needed for AI games and questions', 402, 'PLUS_REQUIRED');
  }
}

async function requireRelationship(env: Env, userId: string, relationshipId: unknown): Promise<string> {
  if (typeof relationshipId !== 'string' || !relationshipId) throw new ApiError('relationship_id is required');
  if (!(await isRelationshipMember(env.DB, userId, relationshipId))) throw new ApiError('Relationship not found', 404);
  return relationshipId;
}

// ---------------------------------------------------------------------------
// generate-daily-challenge: one shared question per date for every couple
// ---------------------------------------------------------------------------

const DAILY_PROMPTS = [
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

const DAILY_BANK: BankSpec<string> = {
  bank: 'daily',
  maxTokens: 2048,
  prompt: (count, avoid) =>
    `Write ${count} warm, specific questions a couple answers about each other, one per day. Each under 20 words. ` +
    'Vary the themes: memories, gratitude, dreams, everyday life, playful, future plans, how we love each other. ' +
    'Return ONLY a JSON array of strings.' +
    avoidList(avoid),
  parse: stringList(200),
  key: (s) => s,
};

function dateHash(date: string) {
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

const DAILY_LOW_WATER = 7;

async function questionForDate(env: Env, date: string, bg: Bg): Promise<string> {
  const existing = await env.DB.prepare('SELECT prompt FROM daily_questions WHERE date = ?1').bind(date).first<{ prompt: string }>();
  if (existing) return existing.prompt;

  const last = await env.DB.prepare('SELECT MAX(bank_seq) AS seq FROM daily_questions').first<{ seq: number | null }>();
  const after = last?.seq ?? 0;
  const upcoming = await readBank<string>(env, DAILY_BANK.bank, after, DAILY_LOW_WATER + 1);
  if (upcoming.length <= DAILY_LOW_WATER) refillLater(env, DAILY_BANK, bg);
  const next = upcoming[0];
  const prompt = next?.item ?? DAILY_PROMPTS[dateHash(date) % DAILY_PROMPTS.length];

  // DO NOTHING + re-read: if two requests race on a new date, both end up with the same question.
  await env.DB.prepare('INSERT INTO daily_questions (date, prompt, bank_seq) VALUES (?1, ?2, ?3) ON CONFLICT (date) DO NOTHING')
    .bind(date, prompt, next?.seq ?? null)
    .run();
  const saved = await env.DB.prepare('SELECT prompt FROM daily_questions WHERE date = ?1').bind(date).first<{ prompt: string }>();
  return saved?.prompt ?? prompt;
}

async function dailyChallenge(env: Env, userId: string, body: Body, bg: Bg) {
  const { limit } = bg;
  const relationshipId = await requireRelationship(env, userId, body.relationship_id);
  await limit(env, `daily:${relationshipId}`, 12, 3600);

  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.challenge_date)) ? String(body.challenge_date) : new Date().toISOString().slice(0, 10);
  const existing = await env.DB.prepare('SELECT * FROM daily_challenges WHERE relationship_id = ?1 AND challenge_date = ?2')
    .bind(relationshipId, date)
    .first<Record<string, unknown>>();
  if (existing) return shapeRow(existing);

  const prompt = await questionForDate(env, date, bg);
  const row = await env.DB.prepare(
    `INSERT INTO daily_challenges (id, relationship_id, prompt, challenge_date) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (relationship_id, challenge_date) DO UPDATE SET prompt = daily_challenges.prompt RETURNING *`,
  )
    .bind(generateId(), relationshipId, prompt, date)
    .first<Record<string, unknown>>();
  return row ? shapeRow(row) : null;
}

// ---------------------------------------------------------------------------
// generate-activity
// ---------------------------------------------------------------------------

type Activity = { title: string; type: string; description: string };

const FALLBACK_ACTIVITIES: Activity[] = [
  { title: 'Sunset walk together', type: 'outdoor', description: 'Take a leisurely walk and share highlights of your day' },
  { title: 'Cook something new', type: 'home', description: 'Pick a recipe neither of you has tried' },
  { title: 'Gratitude exchange', type: 'conversation', description: 'Share three things you appreciate about each other today' },
];

// Bucketed so couples with similar requests share a bank instead of each paying for their own batch.
function budgetBucket(budget: number): [string, string] {
  if (!(budget > 0)) return ['free', 'free (no money spent)'];
  if (budget <= 25) return ['low', 'under $25'];
  if (budget <= 75) return ['mid', 'under $75'];
  return ['high', 'a generous budget'];
}

function timeBucket(hours: number): [string, string] {
  if (!(hours > 1)) return ['short', 'about an hour'];
  if (hours <= 3) return ['medium', '1-3 hours'];
  return ['long', 'half a day or more'];
}

function activityBank(mood: string, budget: number, hours: number): BankSpec<Activity> {
  const [budgetKey, budgetText] = budgetBucket(budget);
  const [timeKey, timeText] = timeBucket(hours);
  const moodText = clean(mood || 'any', 40);
  return {
    bank: `activity:${slug(moodText) || 'any'}:${budgetKey}:${timeKey}`,
    maxTokens: 4096,
    batch: 12,
    prompt: (count, avoid) =>
      `Generate ${count} couple activity ideas. Mood: ${moodText}. Budget: ${budgetText}. Time: ${timeText}. ` +
      'Keep the tone warm and natural, not robotic. Return ONLY a JSON array of objects with "title", "type" and "description".' +
      avoidList(avoid),
    parse: (text) =>
      jsonArray(text).flatMap((a: any) =>
        typeof a?.title === 'string' && typeof a?.description === 'string'
          ? [{ title: clean(a.title, 80), type: clean(String(a.type ?? 'other'), 30), description: clean(a.description, 240) }]
          : [],
      ),
    key: (a) => a.title,
  };
}

async function generateActivity(env: Env, userId: string, body: Body, bg: Bg) {
  const { limit } = bg;
  const relationshipId = await requireRelationship(env, userId, body.relationship_id);
  await limit(env, `activity:user:${userId}`, 20, 86_400);
  await limit(env, `activity:rel:${relationshipId}`, 40, 86_400);
  await requirePlus(env, relationshipId);

  const spec = activityBank(String(body.mood ?? ''), Number(body.budget), Number(body.time_available));
  const activities = await serveFromBank(env, relationshipId, spec, 4, bg);
  return { activities: activities.length ? activities : FALLBACK_ACTIVITIES };
}

// ---------------------------------------------------------------------------
// generate-quiz-live
// ---------------------------------------------------------------------------

type QuizQuestion = { question: string; type: 'choice' | 'boolean'; options: string[]; correctIndex?: number };

function normalizeQuiz(raw: unknown): QuizQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: QuizQuestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const q = item as Record<string, any>;
    const question = typeof q.question === 'string' ? q.question.trim() : '';
    const options = Array.isArray(q.options) ? q.options.map((o: unknown) => String(o).trim()).filter(Boolean) : [];
    if (!question) continue;
    if (q.type === 'boolean') {
      const opts = options.length >= 2 ? options.slice(0, 2) : ['True', 'False'];
      out.push({ question, type: 'boolean', options: opts, correctIndex: [0, 1].includes(q.correctIndex) ? q.correctIndex : undefined });
    } else if (q.type === 'choice' && options.length >= 2) {
      const opts = options.slice(0, 4);
      while (opts.length < 4) opts.push(`Option ${opts.length + 1}`);
      out.push({ question, type: 'choice', options: opts, correctIndex: Number.isInteger(q.correctIndex) && q.correctIndex < opts.length ? q.correctIndex : undefined });
    }
  }
  return out;
}

// Free-text topics stay private to the couple: a shared bank keyed by someone else's text could be steered.
function quizLiveBank(relationshipId: string, topic: string): BankSpec<QuizQuestion> {
  return {
    bank: `quizlive:${relationshipId}:${slug(topic) || 'general'}`,
    maxTokens: 6000,
    batch: 12,
    prompt: (count, avoid) => `Generate exactly ${count} quiz questions for a live couple quiz game.

Topic / instructions from the players: "${topic}"

Rules:
- Mix multiple-choice (4 options) and true/false questions (use type "boolean" with options ["True","False"]), roughly half each.
- Questions can be about ANY subject matching the topic — not only relationships.
- For factual questions include correctIndex (0-based). For opinion/prediction questions omit correctIndex.
- Keep questions concise, fun, and playable on a phone.
- No offensive content.

Return ONLY a JSON array of objects:
{ "question": string, "type": "choice"|"boolean", "options": string[], "correctIndex"?: number }${avoidList(avoid)}`,
    parse: (text) => normalizeQuiz(jsonArray(text)),
    key: (q) => q.question,
  };
}

async function generateQuizLive(env: Env, userId: string, body: Body, bg: Bg) {
  const { limit } = bg;
  const relationshipId = await requireRelationship(env, userId, body.relationship_id);
  if (typeof body.topic !== 'string' || !body.topic.trim()) throw new ApiError('topic and relationship_id are required');
  await limit(env, `quiz:${relationshipId}`, 15, 3600);

  const count = Math.min(8, Math.max(4, Number(body.count) || 6));
  const usage = await checkAi(env, relationshipId, 'question', count);
  const questions = await serveFromBank(env, relationshipId, quizLiveBank(relationshipId, clean(body.topic, 200)), count, bg);
  // Too few => the app substitutes its bundled fallback questions (and nothing is counted).
  const out = questions.length >= 4 ? questions : [];
  if (out.length) await recordAi(env, relationshipId, usage, 'question', out.length);
  return { questions: out };
}

// ---------------------------------------------------------------------------
// generate-game-content
// ---------------------------------------------------------------------------

const GAMES = ['wouldYouRather', 'thisOrThat', 'whosLikely', 'truthDare', 'guessAnswer', 'quiz'] as const;
type Game = (typeof GAMES)[number];

const VIBES: Record<string, string> = {
  sweet: 'warm, wholesome and affectionate',
  playful: 'silly, light-hearted and funny',
  spicy: 'flirty and romantic, strictly PG-13, never explicit',
  deep: 'thoughtful, honest and emotionally meaningful',
};

type Pair = { a: string; b: string };
type Prompt = { text: string };
type Trivia = { question: string; options: string[]; correctIndex: number };

// Banks are shared between couples, so prompts never include a couple's names.
const gameBase = (vibe: string) =>
  `The players are a couple. Tone: ${VIBES[vibe]}. Keep it fresh, specific and free of clichés. Never be crude, cruel or explicit. Return ONLY valid JSON, no prose.`;

const pairs = (text: string | null): Pair[] =>
  jsonArray(text).flatMap((p: any) =>
    typeof p?.a === 'string' && typeof p?.b === 'string' ? [{ a: clean(p.a, 90), b: clean(p.b, 90) }] : [],
  );

const prompts = (text: string | null): Prompt[] => stringList(160)(text).map((t) => ({ text: t }));

function pairBank(game: 'wouldYouRather' | 'thisOrThat', vibe: string): BankSpec<Pair> {
  const ask =
    game === 'wouldYouRather'
      ? 'Write {n} "Would you rather" dilemmas for two partners playing together. Each option under 12 words, both options equally tempting.'
      : 'Write {n} rapid "This or That" pairs (1-4 words per side) about lifestyle, romance and preferences.';
  return {
    bank: `game:${game}:${vibe}`,
    maxTokens: 4096,
    prompt: (n, avoid) => `${gameBase(vibe)}\n${ask.replace('{n}', String(n))} Shape: [{"a":"...","b":"..."}]${avoidList(avoid)}`,
    parse: pairs,
    key: (p) => `${p.a} / ${p.b}`,
  };
}

function promptBank(bank: string, vibe: string, ask: string): BankSpec<Prompt> {
  return {
    bank,
    maxTokens: 4096,
    prompt: (n, avoid) => `${gameBase(vibe)}\n${ask.replace('{n}', String(n))} Shape: ["...", "..."]${avoidList(avoid)}`,
    parse: prompts,
    key: (p) => p.text,
  };
}

function triviaBank(topic: string, relationshipId?: string): BankSpec<Trivia> {
  const subject = topic || 'general knowledge and romance';
  return {
    bank: topic && relationshipId ? `game:quiz:${relationshipId}:${slug(topic)}` : 'game:quiz:general',
    maxTokens: 6000,
    batch: 12,
    prompt: (n, avoid) =>
      `Write ${n} multiple-choice trivia questions about "${subject}" for a two-player quiz. Mix easy and medium difficulty; exactly 4 options for each unless it is true/false (2 options: "True","False"). Exactly one correct answer; put its 0-based index in correctIndex. Return ONLY valid JSON: [{"question":"...","options":["..."],"correctIndex":0}]` +
      avoidList(avoid),
    parse: (text) =>
      jsonArray(text).flatMap((q: any) => {
        const options = Array.isArray(q?.options) ? q.options.map((o: unknown) => clean(String(o), 80)).filter(Boolean) : [];
        return typeof q?.question === 'string' && options.length >= 2 && options.length <= 4 && Number.isInteger(q.correctIndex)
          ? [{ question: clean(q.question, 200), options, correctIndex: q.correctIndex }]
          : [];
      }),
    key: (q) => q.question,
  };
}

function gameBanks(vibe: string) {
  return {
    wouldYouRather: pairBank('wouldYouRather', vibe),
    thisOrThat: pairBank('thisOrThat', vibe),
    whosLikely: promptBank(
      `game:whosLikely:${vibe}`,
      vibe,
      `Write {n} "Who's more likely to ..." questions where the answer is one of the two partners. Start each with "Who's more likely to".`,
    ),
    guessAnswer: promptBank(
      `game:guessAnswer:${vibe}`,
      vibe,
      `Write {n} questions one partner answers secretly about themselves that the other partner then tries to guess. Phrase them as "What's my ..." or "What would I ...".`,
    ),
    truth: promptBank(`game:truthDare:truth:${vibe}`, vibe, 'Write {n} "truth" questions for a couple playing truth or dare.'),
    dare: promptBank(
      `game:truthDare:dare:${vibe}`,
      vibe,
      'Write {n} dares for a couple playing truth or dare. Dares must be doable at home on an audio call with no props (voice, acting, compliments, tiny challenges).',
    ),
  };
}

async function gameContent(env: Env, relationshipId: string, game: Game, vibe: string, count: number, topic: string, bg: Bg) {
  const banks = gameBanks(vibe);
  switch (game) {
    case 'wouldYouRather':
    case 'thisOrThat':
      return { items: await serveFromBank(env, relationshipId, banks[game], count, bg) };
    case 'whosLikely':
    case 'guessAnswer':
      return { items: await serveFromBank<Prompt>(env, relationshipId, banks[game], count, bg) };
    case 'truthDare': {
      const n = Math.max(6, count);
      const [truth, dare] = await Promise.all([
        serveFromBank(env, relationshipId, banks.truth, n, bg),
        serveFromBank(env, relationshipId, banks.dare, n, bg),
      ]);
      return { pool: { truth: truth.map((p) => p.text), dare: dare.map((p) => p.text) } };
    }
    case 'quiz':
      return { items: await serveFromBank(env, relationshipId, triviaBank(topic, relationshipId), count, bg) };
  }
}

async function generateGameContent(env: Env, userId: string, body: Body, bg: Bg) {
  const { limit } = bg;
  const relationshipId = await requireRelationship(env, userId, body.relationship_id);
  const game = String(body.game ?? '') as Game;
  if (!GAMES.includes(game)) throw new ApiError('Unsupported game');
  await limit(env, `game:${userId}`, 40, 3600);

  const vibe = VIBES[String(body.vibe)] ? String(body.vibe) : 'playful';
  const count = Math.max(3, Math.min(20, Number(body.count) || 8));
  const topic = clean(String(body.topic ?? ''), 80);
  // A custom quiz topic is the one case that can need a brand-new AI batch, so only that stays metered.
  const metered = game === 'quiz' && !!topic;
  const usage = metered ? await checkAi(env, relationshipId, 'game') : await requirePlus(env, relationshipId);

  const content = await gameContent(env, relationshipId, game, vibe, count, topic, bg);
  if (metered && usage && content.items?.length) await recordAi(env, relationshipId, usage, 'game');
  return content;
}

// ---------------------------------------------------------------------------
// Pre-generation: keeps every standard bank stocked so games are AI-made from the first round
// ---------------------------------------------------------------------------

const STOCK_TARGET = 60;

function standardBanks(): BankSpec<any>[] {
  return [DAILY_BANK, triviaBank(''), ...Object.keys(VIBES).flatMap((vibe) => Object.values(gameBanks(vibe)))];
}

/** Fills the emptiest standard banks, at most `maxFills` AI calls. Returns the banks still below target. */
export async function stockBanks(env: Env, maxFills: number): Promise<number> {
  const { results } = await env.DB.prepare('SELECT bank, COUNT(*) AS n FROM content_bank GROUP BY bank').all<{ bank: string; n: number }>();
  const counts = new Map(results.map((r) => [r.bank, r.n]));
  const low = standardBanks()
    .map((spec) => ({ spec, n: counts.get(spec.bank) ?? 0 }))
    .filter((b) => b.n < STOCK_TARGET)
    .sort((a, b) => a.n - b.n);
  for (const { spec } of low.slice(0, maxFills)) await fillBank(env, spec);
  return Math.max(0, low.length - maxFills);
}

// ---------------------------------------------------------------------------
// send-push-notification
// ---------------------------------------------------------------------------

function pushTitle(type: string): string {
  switch (type) {
    case 'message':
      return 'New message';
    case 'moment':
      return 'New moment';
    case 'mood':
      return 'Mood update';
    case 'streak':
      return 'Streak update';
    case 'challenge':
      return "Today's question";
    case 'game_invite':
      return 'Game time';
    case 'game_turn':
      return 'Your move';
    case 'partner_joined':
      return 'You’re connected';
    case 'referral_credit':
      return 'You earned Plus';
    case 'plus_unlocked':
    case 'plus_suggest':
      return 'Moments Plus';
    default:
      return 'Moments';
  }
}

/** Which Settings > Notifications switch covers each type. Keep in sync with src/lib/notification-prefs.ts. */
const PUSH_CATEGORY: Record<string, string> = {
  message: 'messages',
  message_new: 'messages',
  moment: 'moments',
  mood: 'moods',
  mood_update: 'moods',
  challenge: 'dailyQuestion',
  streak: 'streaks',
  game_invite: 'games',
  game_turn: 'games',
};

function pushAllowed(prefsRaw: string | null, type: string): boolean {
  const category = PUSH_CATEGORY[type];
  if (!category || !prefsRaw) return true;
  try {
    return (JSON.parse(prefsRaw) as Record<string, unknown>)[category] !== false;
  } catch {
    return true;
  }
}

async function sendPush(env: Env, userId: string, body: Body, limit: RateLimiter) {
  try {
    await limit(env, `push:${userId}`, 120, 3600);
  } catch {
    return { sent: 0, skipped: 0, rate_limited: true };
  }
  const max = typeof body.limit === 'number' ? Math.min(body.limit, 50) : 10;

  const { results: rows } = await env.DB.prepare(
    `UPDATE notifications SET push_dispatched = 1
     WHERE id IN (
       SELECT n.id FROM notifications n
       WHERE n.push_dispatched = 0 AND n.read = 0
         AND n.relationship_id IN (SELECT id FROM relationships WHERE user_1_id = ?1 OR user_2_id = ?1)
       ORDER BY n.created_at ASC LIMIT ?2)
     RETURNING id, user_id, type, content, relationship_id`,
  )
    .bind(userId, max)
    .all<{ id: string; user_id: string; type: string; content: string; relationship_id: string }>();
  if (rows.length === 0) return { sent: 0, skipped: 0 };

  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { results: users } = await env.DB.prepare(
    `SELECT id, expo_push_token, notification_prefs FROM users WHERE id IN (${ids.map((_, i) => `?${i + 1}`).join(', ')})`,
  )
    .bind(...ids)
    .all<{ id: string; expo_push_token: string | null; notification_prefs: string | null }>();
  const tokens = new Map(users.filter((u) => u.expo_push_token).map((u) => [u.id, u.expo_push_token as string]));
  const prefs = new Map(users.map((u) => [u.id, u.notification_prefs]));

  const messages: Record<string, unknown>[] = [];
  const unsent: string[] = [];
  for (const row of rows) {
    // Turned off in Settings: stays in the in-app list, no push (and stays marked dispatched).
    if (!pushAllowed(prefs.get(row.user_id) ?? null, row.type)) continue;
    const token = tokens.get(row.user_id);
    if (!token) {
      unsent.push(row.id);
      continue;
    }
    messages.push({
      to: token,
      title: pushTitle(row.type),
      body: row.content,
      sound: 'default',
      data: { notification_id: row.id, type: row.type, relationship_id: row.relationship_id },
    });
  }

  const release = async (list: string[]) => {
    if (!list.length) return;
    await env.DB.prepare(`UPDATE notifications SET push_dispatched = 0 WHERE id IN (${list.map((_, i) => `?${i + 1}`).join(', ')})`)
      .bind(...list)
      .run();
  };

  if (messages.length) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      await release(rows.map((r) => r.id));
      return { sent: 0, skipped: 0, error: `Expo push failed (${res.status})` };
    }
  }
  await release(unsent);
  return { sent: messages.length, skipped: unsent.length };
}

export async function runFunction(env: Env, userId: string, name: string, body: Body, limit: RateLimiter, defer: Defer) {
  const bg: Bg = { limit, defer };
  switch (name) {
    case 'generate-daily-challenge':
      return dailyChallenge(env, userId, body, bg);
    case 'generate-activity':
      return generateActivity(env, userId, body, bg);
    case 'generate-quiz-live':
      return generateQuizLive(env, userId, body, bg);
    case 'generate-game-content':
      return generateGameContent(env, userId, body, bg);
    case 'send-push-notification':
      return sendPush(env, userId, body, limit);
    default:
      throw new ApiError(`Unknown function ${name}`, 404);
  }
}
