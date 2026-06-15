import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    .select('id, status')
    .eq('id', relationshipId)
    .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
    .single();

  if (error || !data) throw new Error('Not a member of this relationship');
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { user, supabase } = await getAuthUser(req);
    const { mood, budget, time_available, relationship_id } = await req.json();

    await verifyRelationship(supabase, user.id, relationship_id);

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

    return new Response(JSON.stringify({ activities }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
