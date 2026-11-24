import { describe, expect, it } from 'vitest';
import { shotsInRegulation, suggestedPath } from '../src/design/suggested-line';

const line = [
  { lat: 47.11, lon: -122.24 },
  { lat: 47.115, lon: -122.24 },
];

describe('suggested line', () => {
  it('uses one, two, or three shots to reach the green in regulation', () => {
    expect(shotsInRegulation(3)).toBe(1);
    expect(shotsInRegulation(4)).toBe(2);
    expect(shotsInRegulation(5)).toBe(3);
    const path = suggestedPath(line, 4, [250, 150]);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThanOrEqual(3);
    expect(path![0]).toEqual(line[0]);
    expect(path![path!.length - 1]).toEqual(line[1]);
  });

  it('stays empty when the hole has no line', () => {
    expect(suggestedPath([{ lat: 1, lon: 2 }], 4, [200])).toBeNull();
  });
});
