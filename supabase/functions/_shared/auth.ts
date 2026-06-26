import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function getAuthUser(req: Request) {
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

export async function verifyRelationship(
  supabase: SupabaseClient,
  userId: string,
  relationshipId: string,
) {
  const { data, error } = await supabase
    .from('relationships')
    .select('id, status')
    .eq('id', relationshipId)
    .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
    .single();

  if (error || !data) throw new Error('Not a member of this relationship');
  return data;
}
