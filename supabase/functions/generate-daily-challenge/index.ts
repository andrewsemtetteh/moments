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

    const { relationship_id } = await req.json();
    const today = new Date().toISOString().split('T')[0];

    const { data: existing } = await supabase
      .from('daily_challenges')
      .select('*')
      .eq('relationship_id', relationship_id)
      .eq('challenge_date', today)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify(existing), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
