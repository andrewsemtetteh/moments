import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { relationship_id, user_id, type, content } = await req.json();

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
      await supabase.from('notifications').insert({
        relationship_id,
        user_id: partnerId,
        type: 'mood_update',
        content: `Your partner shared their mood: ${content}`,
      });
    }

    await supabase.rpc('update_streak', { p_relationship_id: relationship_id });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
