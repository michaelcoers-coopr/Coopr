import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const play = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../app/play.tsx'), 'utf8');

describe('left rail hole screen', () => {
  it('floats the yardage and the thumb rail, and keeps weather in Stats', () => {
    expect(play).toContain('YARDS TO GREEN');
    expect(play).toContain('TEE SHOT ');
    expect(play).toContain('ellipseScale={1.2}');
    expect(play).toContain('labels={[]}');
    expect(play).toContain('creditLeft={14}');
    expect(play).toContain('>WIND<');
    expect(play).toContain('>ELEV<');
    expect(play).toContain('>TEMP<');
    expect(play).toContain('>PUTTS<');
    expect(play).toContain('>MARK<');
    expect(play).toContain('rail: true');
    expect(play).toContain('Waiting for GPS · tap to set position');
    expect(play).toContain('Fewer putts');
    expect(play).toContain('More putts');
    expect(play).not.toContain('>Tee shot<');
    expect(play).not.toContain('Mark shot</Text>');
    expect(play).not.toContain('shotChips');
  });
});
