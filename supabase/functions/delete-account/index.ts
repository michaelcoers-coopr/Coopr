// Supabase Edge Function: hard account deletion (invariant 8 — the golfer owns their
// history and can delete it). Verifies the caller's JWT, then deletes the auth user
// with the service role; owner_id FKs (on delete cascade) remove their rows.
//
// Deploy: `supabase functions deploy delete-account`
// The app calls it via supabase.functions.invoke('delete-account').

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const auth = req.headers.get('Authorization') ?? '';
  const jwt = auth.replace('Bearer ', '').trim();
  if (!jwt) return new Response('missing bearer token', { status: 401 });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return new Response('unauthorized', { status: 401 });

  const { error: delErr } = await admin.auth.admin.deleteUser(data.user.id);
  if (delErr) return new Response(delErr.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
});
