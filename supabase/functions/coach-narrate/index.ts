// Supabase Edge Function: rewrite a GROUNDED coach answer in the caddie's voice.
// The Anthropic key lives here as a secret (never in the app). The model only rephrases
// the facts it is given — it must not change any number, distance, club, or
// recommendation (invariant 1). Invoked by the app via functions.invoke('coach-narrate').
//
// Setup:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy coach-narrate --no-verify-jwt
// The app currently uses local (offline) auth, so it calls this with the project's
// publishable/anon key rather than a user JWT — hence --no-verify-jwt. When cloud auth
// lands, drop that flag to require a signed-in user. Optional model override:
//   supabase secrets set COACH_MODEL=claude-haiku-4-5-20251001

interface Body {
  question: string;
  groundedTitle: string;
  groundedText: string;
  persona: { name: string; humorLevel: number; detailLevel: number; coachingStyle: string };
}

const MODEL = Deno.env.get('COACH_MODEL') ?? 'claude-haiku-4-5-20251001';

Deno.serve(async (req: Request) => {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return new Response('ANTHROPIC_API_KEY not set', { status: 500 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }
  const p = body.persona;
  const humor = p.humorLevel > 0.6 ? 'quite funny' : p.humorLevel > 0.3 ? 'lightly humorous' : 'mostly serious';
  const detail = p.detailLevel > 0.7 ? 'thorough with the numbers' : p.detailLevel > 0.4 ? 'balanced' : 'brief';

  const system =
    `You are ${p.name}, a golf caddie. Voice: ${p.coachingStyle}; ${humor}; ${detail}. ` +
    `Rewrite the caddie ANSWER below in your voice so it reads like you're talking to the golfer. ` +
    `HARD RULES: do not change, add, or remove any number, distance, club, percentage, or recommendation. ` +
    `Do not invent new advice or facts. If a fact isn't in the answer, don't mention it. Keep it to a few sentences. ` +
    `No markdown headers or bullet symbols — just natural speech.`;

  const userContent =
    `The golfer asked: "${body.question}"\n\n` +
    `ANSWER TO REPHRASE (ground truth — keep every number and recommendation exactly):\n` +
    `${body.groundedTitle}\n${body.groundedText}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(`anthropic error: ${err}`, { status: 502 });
  }
  const data = await res.json();
  const text = (data?.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n').trim();
  return new Response(JSON.stringify({ text }), { headers: { 'content-type': 'application/json' } });
});
