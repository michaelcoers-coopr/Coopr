import type { SurveyEase, SurveyResponse, SurveyUse } from './types';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SurveyDraft = {
  name?: unknown;
  ease?: unknown;
  wouldUse?: unknown;
  next?: unknown;
  email?: unknown;
  emailConsent?: unknown;
};

/**
 * LEGAL REVIEW: the golfer-facing consent is in SURVEY_CONSENT.
 * Counsel should sign off before the Panthers Classic. Skip stores nothing.
 */
export const SURVEY_CONSENT = 'Email me about COOPR. I agree to be contacted at this address.';
export const SURVEY_PRIVACY = 'Your name and these three answers are saved with this event. An email is saved only if you check the box. Skip this and nothing new is stored.';

function easeOf(value: unknown): SurveyEase | null {
  return value === 'easy' || value === 'ok' || value === 'hard' ? value : null;
}

function useOf(value: unknown): SurveyUse | null {
  return value === 'yes' || value === 'maybe' || value === 'no' ? value : null;
}

export function reviewSurvey(input: SurveyDraft): { ok: true; ease: SurveyEase; wouldUse: SurveyUse; next: string; email: string | null; emailConsent: boolean; name: string } | { ok: false; error: string } {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < 1 || name.length > 60) return { ok: false, error: 'Add the name you used to join.' };
  const ease = easeOf(input.ease);
  const wouldUse = useOf(input.wouldUse);
  if (!ease || !wouldUse) return { ok: false, error: 'Answer the first two questions, or skip.' };
  const next = typeof input.next === 'string' ? input.next.trim().slice(0, 280) : '';
  const consent = input.emailConsent === true;
  const rawEmail = typeof input.email === 'string' ? input.email.trim() : '';
  if (rawEmail && !consent) return { ok: false, error: 'Check the box before we save an email, or leave the email blank.' };
  if (consent && rawEmail && !EMAIL.test(rawEmail)) return { ok: false, error: 'That email does not look complete.' };
  if (consent && rawEmail.length > 120) return { ok: false, error: 'That email is too long.' };
  return { ok: true, ease, wouldUse, next, email: consent && rawEmail ? rawEmail : null, emailConsent: consent && rawEmail.length > 0, name };
}

export function surveyPublicSafe(rows: SurveyResponse[]): boolean {
  return rows.every((row) => row.email == null || row.emailConsent);
}
