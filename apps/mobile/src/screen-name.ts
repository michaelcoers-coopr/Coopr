const SKIP = new Set(['feedback', 'privacy']);

let remembered = 'Home';

/** The last screen that is not Feedback or Privacy. */
export function rememberScreen(name: string): void {
  const trimmed = name.trim();
  if (!trimmed || SKIP.has(trimmed.toLowerCase())) return;
  remembered = trimmed;
}

export function rememberedScreen(): string {
  return remembered;
}
