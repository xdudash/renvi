import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

// Service-role client: only inside Edge Functions, never shipped to the app.
export function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
}

// Client acting as the caller (RLS applies).
export function asUser(req: Request): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
}

export async function callerId(req: Request): Promise<string | null> {
  const { data } = await asUser(req).auth.getUser();
  return data.user?.id ?? null;
}

export async function removeFolder(client: SupabaseClient, prefix: string) {
  for (const sub of ['profile', 'verify', 'chat', 'voice', 'export']) {
    const { data } = await client.storage.from('profile-media').list(`${prefix}/${sub}`, { limit: 1000 });
    if (data?.length) await client.storage.from('profile-media').remove(data.map((f) => `${prefix}/${sub}/${f.name}`));
  }
}
