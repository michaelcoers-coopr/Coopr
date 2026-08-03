import type { LanguageProvider, CoachNarrationInput, CaddiePersona } from '@coopr/core';
import type { SupabaseClient } from '@supabase/supabase-js';

// Calls the coach-narrate edge function (which holds the Anthropic key server-side).
// The model only rephrases grounded facts; it never decides golf actions. If the
// function is not deployed or errors, callers fall back to the deterministic answer.
export class SupabaseLanguageProvider implements LanguageProvider {
  constructor(private readonly client: SupabaseClient) {}

  async narrateCoach(input: CoachNarrationInput): Promise<string> {
    const { data, error } = await this.client.functions.invoke('coach-narrate', { body: input });
    if (error) throw error;
    const text = (data as { text?: string } | null)?.text;
    if (!text) throw new Error('empty narration');
    return text;
  }

  async narrate(reasons: { code: string; text: string }[], persona: CaddiePersona): Promise<string> {
    return this.narrateCoach({
      question: 'Explain this recommendation.',
      groundedTitle: 'Recommendation',
      groundedText: reasons.map((r) => `- ${r.text}`).join('\n'),
      persona,
    });
  }
}
