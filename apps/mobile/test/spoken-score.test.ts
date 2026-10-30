import { describe, expect, it } from 'vitest';
import { gpsPollMs } from '../src/gps-fix';
import { spokenConfirm, spokenStrokes } from '../src/design/spoken-score';

describe('spoken score', () => {
  it('reads a whole phrase and asks before saving', () => {
    expect(spokenStrokes('par', 5)).toBe(5);
    expect(spokenStrokes('birdie', 4)).toBe(3);
    expect(spokenStrokes('bogey', 4)).toBe(5);
    expect(spokenStrokes('double bogey', 3)).toBe(5);
    expect(spokenStrokes('6', 4)).toBe(6);
    expect(spokenStrokes('what club for a par 5', 5)).toBeNull();
    expect(spokenStrokes('0', 4)).toBeNull();
    expect(spokenConfirm('par', 5)).toBe('Save 5?');
    expect(spokenConfirm('how far', 4)).toBeNull();
  });

  it('slows the GPS poll when battery saver is on', () => {
    expect(gpsPollMs(false)).toBe(700);
    expect(gpsPollMs(true)).toBeGreaterThan(gpsPollMs(false));
  });
});
