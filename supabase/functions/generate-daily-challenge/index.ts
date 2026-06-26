import { getAuthUser, verifyRelationship } from '../_shared/auth.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { enforceRateLimit, RATE_LIMITS, RateLimitError } from '../_shared/rate-limit.ts';

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const { user, supabase } = await getAuthUser(req);
    const { relationship_id } = await req.json();

    if (!relationship_id) throw new Error('relationship_id is required');

    await verifyRelationship(supabase, user.id, relationship_id);
    await enforceRateLimit(
      { functionName: 'generate-daily-challenge', relationshipId: relationship_id },
      RATE_LIMITS.generateDailyChallenge.maxHits,
      RATE_LIMITS.generateDailyChallenge.windowSeconds,
    );

    const today = new Date().toISOString().split('T')[0];

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
      'What do you appreciate about your partner today?',
      'Share a photo of where you are right now',
      'What made you smile today?',
      'Describe your ideal evening together',
      'What\'s one thing you want to do together this week?',
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
