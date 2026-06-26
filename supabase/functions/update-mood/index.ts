import { getAuthUser } from '../_shared/auth.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { enforceRateLimit, RATE_LIMITS, RateLimitError } from '../_shared/rate-limit.ts';

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const { user, supabase } = await getAuthUser(req);
    const { relationship_id } = await req.json();

    if (!relationship_id) throw new Error('relationship_id is required');

    await enforceRateLimit(
      { functionName: 'update-mood', userId: user.id },
      RATE_LIMITS.updateMood.maxHits,
      RATE_LIMITS.updateMood.windowSeconds,
    );

    const { data: rel } = await supabase
      .from('relationships')
      .select('user_1_id, user_2_id')
      .eq('id', relationship_id)
      .single();

    if (!rel || (rel.user_1_id !== user.id && rel.user_2_id !== user.id)) {
      throw new Error('Unauthorized');
    }

    const partnerId = rel.user_1_id === user.id ? rel.user_2_id : rel.user_1_id;

    if (partnerId) {
      await supabase.rpc('update_streak', { p_relationship_id: relationship_id });
    }

    return jsonResponse({ success: true });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return jsonResponse({ error: e.message }, 429);
    }
    const message = e instanceof Error ? e.message : 'Request failed';
    return jsonResponse({ error: message }, 400);
  }
});
