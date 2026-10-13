import { checkAi, recordAi } from './billing';
import { ApiError, shapeRow } from './core';
import { generateId, isRelationshipMember } from './db';
import './env';

type RateLimiter = (env: Env, bucket: string, maxHits: number, windowSeconds: number) => Promise<void>;
type Body = Record<string, any>;

// ---------------------------------------------------------------------------
// Anthropic helper
// ---------------------------------------------------------------------------

async function askClaude(env: Env, model: string, maxTokens: number, prompt: string): Promise<string | null> {
  if (!env.ANTHROPIC_API_KEY) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { content?: { text?: string }[] };
  return json.content?.[0]?.text ?? null;
}

async function requireRelationship(env: Env, userId: string, relationshipId: unknown): Promise<string> {
  if (typeof relationshipId !== 'string' || !relationshipId) throw new ApiError('relationship_id is required');
  if (!(await isRelationshipMember(env.DB, userId, relationshipId))) throw new ApiError('Relationship not found', 404);
  return relationshipId;
}

// ---------------------------------------------------------------------------
// generate-daily-challenge
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

async function dailyChallenge(env: Env, userId: string, body: Body, limit: RateLimiter) {
  const relationshipId = await requireRelationship(env, userId, body.relationship_id);
  await limit(env, `daily:${relationshipId}`, 12, 3600);

  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.challenge_date)) ? String(body.challenge_date) : new Date().toISOString().slice(0, 10);
  const existing = await env.DB.prepare('SELECT * FROM daily_challenges WHERE relationship_id = ?1 AND challenge_date = ?2')
    .bind(relationshipId, date)
    .first<Record<string, unknown>>();
  if (existing) return shapeRow(existing);

  const aiText = await askClaude(
    env,
    'claude-haiku-4-5-20251001',
    200,
    'Write ONE warm, specific question a couple can answer about each other today. Under 20 words. Return only the question.',
  );
  const prompt = aiText?.trim().replace(/^["']|["']$/g, '') || DAILY_PROMPTS[Math.floor(Math.random() * DAILY_PROMPTS.length)];

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

const FALLBACK_ACTIVITIES = [
  { title: 'Sunset walk together', type: 'outdoor', description: 'Take a leisurely walk and share highlights of your day' },
  { title: 'Cook something new', type: 'home', description: 'Pick a recipe neither of you has tried' },
  { title: 'Gratitude exchange', type: 'conversation', description: 'Share three things you appreciate about each other today' },
];

async function generateActivity(env: Env, userId: string, body: Body, limit: RateLimiter) {
  const relationshipId = await requireRelationship(env, userId, body.relationship_id);
  await limit(env, `activity:user:${userId}`, 20, 86_400);
  await limit(env, `activity:rel:${relationshipId}`, 40, 86_400);
  const usage = await checkAi(env, relationshipId, 'game');

  const text = await askClaude(
    env,
    'claude-haiku-4-5-20251001',
    1024,
    `Generate 3-5 couple activity ideas. Mood: ${body.mood}, Budget: $${body.budget}, Time: ${body.time_available} hours. Return JSON array with objects having title, type, description. Keep tone warm and natural, not robotic. Only return valid JSON.`,
  );
  let activities: unknown[] = [];
  const match = text?.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      activities = JSON.parse(match[0]);
    } catch {
      activities = [];
    }
  }
  if (activities.length) await recordAi(env, relationshipId, usage, 'game');
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
    if (out.length >= 8) break;
  }
  return out;
}

async function generateQuizLive(env: Env, userId: string, body: Body, limit: RateLimiter) {
  const relationshipId = await requireRelationship(env, userId, body.relationship_id);
  if (typeof body.topic !== 'string' || !body.topic.trim()) throw new ApiError('topic and relationship_id are required');
  await limit(env, `quiz:${relationshipId}`, 15, 3600);

  const count = Math.min(8, Math.max(4, Number(body.count) || 6));
  const usage = await checkAi(env, relationshipId, 'question', count);
  const text = await askClaude(
    env,
    'claude-haiku-4-5-20251001',
    2048,
    `Generate exactly ${count} quiz questions for a live couple quiz game.

Topic / instructions from the players: "${body.topic.trim()}"

Rules:
- Mix multiple-choice (4 options) and true/false questions (use type "boolean" with options ["True","False"]).
- At least 2 true/false and at least 2 multiple-choice.
- Questions can be about ANY subject matching the topic — not only relationships.
- For factual questions include correctIndex (0-based). For opinion/prediction questions omit correctIndex.
- Keep questions concise, fun, and playable on a phone.
- No offensive content.

Return ONLY a JSON array of objects:
{ "question": string, "type": "choice"|"boolean", "options": string[], "correctIndex"?: number }`,
  );
  const match = text?.match(/\[[\s\S]*\]/);
  let questions: QuizQuestion[] = [];
  if (match) {
    try {
      questions = normalizeQuiz(JSON.parse(match[0]));
    } catch {
      questions = [];
    }
  }
  // Empty => the app substitutes its bundled fallback questions (and nothing is counted).
  const out = questions.length >= 4 ? questions.slice(0, count) : [];
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

const clean = (text: string, max: number) => text.replace(/\s+/g, ' ').trim().slice(0, max);

function gamePrompt(game: Game, vibe: string, count: number, topic: string, names: string[]) {
  const tone = VIBES[vibe] ?? VIBES.playful;
  const who = names.length === 2 ? `The couple is ${names[0]} and ${names[1]}.` : 'The players are a couple.';
  const base = `${who} Tone: ${tone}. Keep it fresh, specific and free of clichés. Never be crude, cruel or explicit. Return ONLY valid JSON, no prose.`;
  switch (game) {
    case 'wouldYouRather':
      return `${base}\nWrite ${count} "Would you rather" dilemmas for two partners playing together. Each option under 12 words, both options equally tempting. Shape: {"items":[{"a":"...","b":"..."}]}`;
    case 'thisOrThat':
      return `${base}\nWrite ${count} rapid "This or That" pairs (1-4 words per side) about lifestyle, romance and preferences. Shape: {"items":[{"a":"...","b":"..."}]}`;
    case 'whosLikely':
      return `${base}\nWrite ${count} "Who's more likely to ..." questions where the answer is one of the two partners. Start each with "Who's more likely to". Shape: {"items":[{"text":"Who's more likely to ..."}]}`;
    case 'truthDare':
      return `${base}\nWrite ${Math.max(6, count)} truths and ${Math.max(6, count)} dares. Dares must be doable at home on an audio call with no props (voice, acting, compliments, tiny challenges). Shape: {"pool":{"truth":["..."],"dare":["..."]}}`;
    case 'guessAnswer':
      return `${base}\nWrite ${count} questions one partner answers secretly about themselves ("What's my ...?") that the other partner then tries to guess. Phrase them as "What's my ..." or "What would I ...". Shape: {"items":[{"text":"..."}]}`;
    case 'quiz':
      return `Write ${count} multiple-choice trivia questions about "${topic || 'general knowledge and romance'}" for a two-player quiz. Mix easy and medium difficulty; exactly 4 options for each unless it is true/false (2 options: "True","False"). Exactly one correct answer; put its 0-based index in correctIndex. Return ONLY valid JSON: {"items":[{"question":"...","options":["..."],"correctIndex":0}]}`;
  }
}

async function generateGameContent(env: Env, userId: string, body: Body, limit: RateLimiter) {
  const relationshipId = await requireRelationship(env, userId, body.relationship_id);
  const game = String(body.game ?? '') as Game;
  if (!GAMES.includes(game)) throw new ApiError('Unsupported game');
  await limit(env, `game:${userId}`, 40, 3600);

  const vibe = String(body.vibe ?? 'playful');
  const count = Math.max(3, Math.min(20, Number(body.count) || 8));
  const topic = clean(String(body.topic ?? ''), 80);
  const names = Array.isArray(body.names) ? body.names.slice(0, 2).map((n: unknown) => clean(String(n), 30)).filter(Boolean) : [];
  const usage = await checkAi(env, relationshipId, 'game');

  const text = await askClaude(env, 'claude-haiku-4-5-20251001', 2048, gamePrompt(game, vibe, count, topic, names));
  const match = text?.match(/\{[\s\S]*\}/);
  if (!match) return { items: [] };
  try {
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed?.items) && parsed.items.length) await recordAi(env, relationshipId, usage, 'game');
    return parsed;
  } catch {
    return { items: [] };
  }
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
    default:
      return 'Moments';
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
    `SELECT id, expo_push_token FROM users WHERE id IN (${ids.map((_, i) => `?${i + 1}`).join(', ')})`,
  )
    .bind(...ids)
    .all<{ id: string; expo_push_token: string | null }>();
  const tokens = new Map(users.filter((u) => u.expo_push_token).map((u) => [u.id, u.expo_push_token as string]));

  const messages: Record<string, unknown>[] = [];
  const unsent: string[] = [];
  for (const row of rows) {
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

export async function runFunction(env: Env, userId: string, name: string, body: Body, limit: RateLimiter) {
  switch (name) {
    case 'generate-daily-challenge':
      return dailyChallenge(env, userId, body, limit);
    case 'generate-activity':
      return generateActivity(env, userId, body, limit);
    case 'generate-quiz-live':
      return generateQuizLive(env, userId, body, limit);
    case 'generate-game-content':
      return generateGameContent(env, userId, body, limit);
    case 'send-push-notification':
      return sendPush(env, userId, body, limit);
    default:
      throw new ApiError(`Unknown function ${name}`, 404);
  }
}
