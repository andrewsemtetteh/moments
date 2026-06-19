import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type QuizQuestion = {
  question: string;
  type: 'choice' | 'boolean';
  options: string[];
  correctIndex?: number;
};

async function getAuthUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Unauthorized');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return { user, supabase };
}

async function verifyRelationship(supabase: ReturnType<typeof createClient>, userId: string, relationshipId: string) {
  const { data, error } = await supabase
    .from('relationships')
    .select('id')
    .eq('id', relationshipId)
    .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
    .single();

  if (error || !data) throw new Error('Not a member of this relationship');
}

function fallbackQuestions(topic: string): QuizQuestion[] {
  const t = topic.toLowerCase();
  if (t.includes('true') || t.includes('false') || t.includes('fact')) {
    return [
      { question: 'The Pacific Ocean is larger than all land on Earth combined.', type: 'boolean', options: ['True', 'False'], correctIndex: 0 },
      { question: 'Honey never spoils.', type: 'boolean', options: ['True', 'False'], correctIndex: 0 },
      { question: 'Lightning never strikes the same place twice.', type: 'boolean', options: ['True', 'False'], correctIndex: 1 },
      { question: 'Octopuses have three hearts.', type: 'boolean', options: ['True', 'False'], correctIndex: 0 },
      { question: 'Venus is the hottest planet in our solar system.', type: 'boolean', options: ['True', 'False'], correctIndex: 0 },
      { question: 'Humans use 100% of their brain at once.', type: 'boolean', options: ['True', 'False'], correctIndex: 1 },
    ];
  }

  return [
    {
      question: `Which fits “${topic}” best?`,
      type: 'choice',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: 1,
    },
    {
      question: `Quick check on ${topic}: pick the most accurate answer.`,
      type: 'choice',
      options: ['First guess', 'Second guess', 'Third guess', 'Fourth guess'],
      correctIndex: 2,
    },
    { question: 'True or false: you could talk about this topic for an hour.', type: 'boolean', options: ['True', 'False'] },
    {
      question: `Another ${topic} question — choose wisely.`,
      type: 'choice',
      options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      correctIndex: 0,
    },
    { question: 'Ready for a harder one?', type: 'boolean', options: ['True', 'False'], correctIndex: 0 },
    {
      question: `Final round on ${topic}.`,
      type: 'choice',
      options: ['Answer 1', 'Answer 2', 'Answer 3', 'Answer 4'],
      correctIndex: 3,
    },
  ];
}

function normalizeQuestions(raw: unknown, topic: string): QuizQuestion[] {
  if (!Array.isArray(raw)) return fallbackQuestions(topic);

  const out: QuizQuestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const q = item as Record<string, unknown>;
    const question = typeof q.question === 'string' ? q.question.trim() : '';
    const type = q.type === 'boolean' ? 'boolean' : q.type === 'choice' ? 'choice' : null;
    const options = Array.isArray(q.options)
      ? q.options.map((o) => String(o).trim()).filter(Boolean)
      : [];
    if (!question || !type) continue;

    if (type === 'boolean') {
      const opts = options.length >= 2 ? options.slice(0, 2) : ['True', 'False'];
      const correctIndex =
        typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < 2 ? q.correctIndex : undefined;
      out.push({ question, type: 'boolean', options: opts, correctIndex });
    } else if (options.length >= 2) {
      const opts = options.slice(0, 4);
      while (opts.length < 4) opts.push(`Option ${opts.length + 1}`);
      const correctIndex =
        typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < opts.length
          ? q.correctIndex
          : undefined;
      out.push({ question, type: 'choice', options: opts, correctIndex });
    }
    if (out.length >= 8) break;
  }

  return out.length >= 4 ? out.slice(0, 8) : fallbackQuestions(topic);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { user, supabase } = await getAuthUser(req);
    const { topic, relationship_id, count = 6 } = await req.json();

    if (!topic || typeof topic !== 'string' || !relationship_id) {
      throw new Error('topic and relationship_id are required');
    }

    await verifyRelationship(supabase, user.id, relationship_id);

    const questionCount = Math.min(8, Math.max(4, Number(count) || 6));
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    let questions: QuizQuestion[] = [];

    if (anthropicKey) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: `Generate exactly ${questionCount} quiz questions for a live couple quiz game.

Topic / instructions from the players: "${topic.trim()}"

Rules:
- Mix multiple-choice (4 options) and true/false questions (use type "boolean" with options ["True","False"]).
- At least 2 true/false and at least 2 multiple-choice.
- Questions can be about ANY subject matching the topic — not only relationships.
- For factual questions include correctIndex (0-based). For opinion/prediction questions omit correctIndex.
- Keep questions concise, fun, and playable on a phone.
- No offensive content.

Return ONLY a JSON array of objects:
{ "question": string, "type": "choice"|"boolean", "options": string[], "correctIndex"?: number }`,
          }],
        }),
      });

      const result = await response.json();
      const text = result.content?.[0]?.text ?? '[]';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      questions = normalizeQuestions(jsonMatch ? JSON.parse(jsonMatch[0]) : [], topic);
    }

    if (!questions.length) {
      questions = fallbackQuestions(topic);
    }

    return new Response(JSON.stringify({ questions: questions.slice(0, questionCount) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Failed to generate quiz' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
