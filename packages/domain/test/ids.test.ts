import { describe, expect, it } from 'vitest';
import { assertPublicDemoAllowed, deterministicEntropy, nullProviders, uuidv7 } from '@coopr/domain';
import { PUBLIC_DEMO } from '@coopr/seed';

describe('uuidv7', () => {
  it('sets the version nibble and the RFC variant', () => {
    const id = uuidv7(Date.UTC(2026, 9, 22), deterministicEntropy(1));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidv7(Date.UTC(2026, 9, 22), deterministicEntropy(1))).toBe(id);
    expect(uuidv7(Date.UTC(2026, 9, 22), deterministicEntropy(2))).not.toBe(id);
  });
});

describe('providers', () => {
  it('null defaults rephrase without choosing and do not throw', async () => {
    const providers = nullProviders();
    expect(providers.courseData.state).toBe('planned');
    await expect(providers.language.rephrase({ text: 'Carry unknown.', personality: 'funny_knowledgeable' })).resolves.toBe(
      'Carry unknown.',
    );
    await expect(providers.sync.pushOutbox()).resolves.toEqual({ pushed: 0 });
  });
});

describe('public demo guard', () => {
  it('allows an empty public demo and refuses a private founder', () => {
    expect(() => assertPublicDemoAllowed(PUBLIC_DEMO)).not.toThrow();
    expect(JSON.stringify(PUBLIC_DEMO)).not.toMatch(/Coers|High Cedars|162\.05|220\.8/);
    expect(() => assertPublicDemoAllowed({ audience: 'private', displayName: 'Mike Coers' })).toThrow(/public demo/);
  });
});
