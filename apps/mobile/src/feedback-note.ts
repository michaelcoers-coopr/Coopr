export const FEEDBACK_CATEGORIES = ['Bug', 'Idea', 'Wrong data', 'Other'] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export interface FeedbackFacts {
  version: string;
  build: string;
  model: string;
  os: string;
  screen: string;
}

/** The exact note the mail app will carry. No location and no name unless the friend typed one. */
export function feedbackBody(input: { category: FeedbackCategory; note: string; contact: string; facts: FeedbackFacts }): string {
  const note = input.note.trim() || '(no note)';
  const contact = input.contact.trim() ? `Contact: ${input.contact.trim()}` : 'Contact: not given';
  return [
    `Category: ${input.category}`,
    '',
    note,
    '',
    contact,
    '',
    `App version: ${input.facts.version}`,
    `Build: ${input.facts.build}`,
    `Device: ${input.facts.model}`,
    `System: ${input.facts.os}`,
    `Screen: ${input.facts.screen}`,
  ].join('\n');
}

export function feedbackMailto(email: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent('COOPR beta feedback')}&body=${encodeURIComponent(body)}`;
}
