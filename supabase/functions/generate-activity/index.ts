import { getAuthUser, verifyRelationship } from '../_shared/auth.ts';
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts';
import { enforceRateLimit, RATE_LIMITS, RateLimitError } from '../_shared/rate-limit.ts';

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const { user, supabase } = await getAuthUser(req);
    const { mood, budget, time_available, relationship_id } = await req.json();

    if (!relationship_id) throw new Error('relationship_id is required');

    await verifyRelationship(supabase, user.id, relationship_id);
    await enforceRateLimit(
      { functionName: 'generate-activity', userId: user.id },
      RATE_LIMITS.generateActivity.maxHits,
      RATE_LIMITS.generateActivity.windowSeconds,
    );
    await enforceRateLimit(
      { functionName: 'generate-activity', relationshipId: relationship_id },
      RATE_LIMITS.generateActivity.maxHits * 2,
      RATE_LIMITS.generateActivity.windowSeconds,
    );

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    let activities;

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
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `Generate 3-5 couple activity ideas. Mood: ${mood}, Budget: $${budget}, Time: ${time_available} hours. Return JSON array with objects having title, type, description. Keep tone warm and natural, not robotic. Only return valid JSON.`,
          }],
        }),
      });

      const result = await response.json();
      const text = result.content?.[0]?.text ?? '[]';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      activities = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    }

    if (!activities?.length) {
      activities = [
        { title: 'Sunset walk together', type: 'outdoor', description: 'Take a leisurely walk and share highlights of your day' },
        { title: 'Cook something new', type: 'home', description: 'Pick a recipe neither of you has tried' },
        { title: 'Gratitude exchange', type: 'conversation', description: 'Share three things you appreciate about each other today' },
      ];
    }

    return jsonResponse({ activities });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return jsonResponse({ error: e.message }, 429);
    }
    const message = e instanceof Error ? e.message : 'Request failed';
    return jsonResponse({ error: message }, 400);
  }
});
