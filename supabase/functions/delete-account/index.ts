// Supabase Edge Function: hard account deletion (invariant 8 — the golfer owns their
// history and can delete it). Verifies the caller's JWT, deletes all of their rows
// across the synced tables (there is no FK cascade), then deletes the auth user. Runs
// with the service role.
//
// Deploy: `supabase functions deploy delete-account`
// The app calls it via supabase.functions.invoke('delete-account').

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SYNCED_TABLES = [
  'golfer_profiles', 'caddie_profiles', 'bags', 'clubs', 'club_feedback', 'sessions',
  'shots', 'calibration_profiles', 'recommendations', 'rounds', 'hole_scores',
  'course_shots', 'integration_connections',
];

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
  const uid = data.user.id;

  for (const table of SYNCED_TABLES) {
    const { error: rowErr } = await admin.from(table).delete().eq('owner_id', uid);
    if (rowErr) return new Response(`failed clearing ${table}: ${rowErr.message}`, { status: 500 });
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) return new Response(delErr.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
});
