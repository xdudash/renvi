import { admin, asUser, cors, json } from '../_shared/clients.ts';
import { resetDemoAccess } from './logic.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  // Do not pass request bodies, credentials or upstream Auth errors to loggers.
  try {
    const user = asUser(req);
    const db = admin();
    const result = await resetDemoAccess(await req.json().catch(() => null), {
      authorize: async () => {
        const { data: identity, error } = await user.auth.getUser();
        if (error || !identity.user) return null;
        const { data, error: denied } = await user.rpc('is_admin');
        return !denied && data === true ? identity.user.id : null;
      },
      eligible: async (id) => {
        // Run with the caller's JWT: the SQL RPC independently re-checks admin status.
        const { data, error } = await user.rpc('admin_demo_accounts');
        if (error) throw new Error('eligibility_failed');
        return data?.find((row: { id: string }) => row.id === id) ?? null;
      },
      authUser: async (id) => {
        const { data, error } = await db.auth.admin.getUserById(id);
        if (error || !data.user?.email) return null;
        return { id: data.user.id, email: data.user.email };
      },
      stillEligible: async (id) => {
        const { data: bot, error } = await db.from('demo_bots').select('user_id').eq('user_id', id).maybeSingle();
        const { data: elevated, error: adminError } = await db.from('admins').select('user_id').eq('user_id', id).maybeSingle();
        return !error && !adminError && Boolean(bot) && !elevated;
      },
      reserve: async (actor, target) => {
        const { data, error } = await db.from('admin_actions').insert({
          admin_id: actor, action: 'demo.password_reset', target_user: target.id, target_id: target.id,
          details: { email: target.email, status: 'requested' },
        }).select('id').single();
        if (error || !data) throw new Error('audit_unavailable');
        return data.id;
      },
      updatePassword: async (id, password) => {
        const { error } = await db.auth.admin.updateUserById(id, { password });
        if (error) throw new Error('reset_unconfirmed');
      },
      finish: async (id, status) => {
        const { data, error } = await db.from('admin_actions').update({ details: { status } })
          .eq('id', id).eq('action', 'demo.password_reset').select('id').single();
        if (error || !data) throw new Error('audit_unavailable');
      },
    });
    return json(result, result.status);
  } catch { return json({ error: 'service_unavailable' }, 503); }
});
