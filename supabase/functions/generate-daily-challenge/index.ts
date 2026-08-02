import { getAuthUser, verifyRelationship } from '../_shared/auth.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { enforceRateLimit, RATE_LIMITS, RateLimitError } from '../_shared/rate-limit.ts';

function isCalendarDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const { user, supabase } = await getAuthUser(req);
    const body = await req.json();
    const { relationship_id, challenge_date } = body;

    if (!relationship_id) throw new Error('relationship_id is required');

    await verifyRelationship(supabase, user.id, relationship_id);
    await enforceRateLimit(
      { functionName: 'generate-daily-challenge', relationshipId: relationship_id },
      RATE_LIMITS.generateDailyChallenge.maxHits,
      RATE_LIMITS.generateDailyChallenge.windowSeconds,
    );

    // Prefer the caller's local calendar date so midnight matches their phone.
    const today = isCalendarDate(challenge_date)
      ? challenge_date
      : new Date().toISOString().split('T')[0];

    const { data: existing } = await supabase
      .from('daily_challenges')
      .select('*')
      .eq('relationship_id', relationship_id)
      .eq('challenge_date', today)
      .maybeSingle();

    if (existing) {
      return jsonResponse(existing);
    }

    const prompts = [
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

    const prompt = prompts[Math.floor(Math.random() * prompts.length)];

    const { data, error } = await supabase
      .from('daily_challenges')
      .insert({ relationship_id, prompt, challenge_date: today })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return jsonResponse({ error: e.message }, 429);
    }
    const message = e instanceof Error ? e.message : 'Request failed';
    return jsonResponse({ error: message }, 400);
  }
});
