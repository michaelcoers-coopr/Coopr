import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const play = readFileSync(join(here, '../app/play.tsx'), 'utf8');
const map = readFileSync(join(here, '../src/hole-map-canvas.tsx'), 'utf8');

describe('left rail hole screen', () => {
  it('floats the yardage and the thumb rail, and keeps weather in Stats', () => {
    expect(play).toContain('YARDS TO GREEN');
    expect(play).toContain('TEE SHOT ');
    expect(play).toContain('ellipseScale={1.2}');
    expect(play).toContain('labels={[]}');
    expect(play).toContain('creditLeft={14}');
    expect(play).toContain('aerialNote={plate ? aerialTreeNote(hole.holeNumber) : null}');
    expect(play).toContain('>WIND<');
    expect(play).toContain('>ELEV<');
    expect(play).toContain('>TEMP<');
    expect(play).toContain('>PUTTS<');
    expect(play).toContain('>MARK<');
    expect(play).toContain('rail: true');
    expect(play).toContain('Waiting for GPS · tap to set position');
    expect(play).toContain('PLAYS LIKE');
    expect(play).toContain('Sample conditions');
    expect(play).toContain('THRU 0');
    expect(play).toContain('carryChipLine(');
    expect(play).toContain('heroPlateClear');
    expect(play).not.toContain('meanCarryYards');
    expect(play).toMatch(/statLive:\s*\{[^}]*backgroundColor:\s*'#02060E'/);
    expect(map).toContain('VECTOR_OVAL_BOX');
    expect(map).toContain('width: 44, height: 44');
    expect(play).toContain('Fewer putts');
    expect(play).toContain('More putts');
    expect(play).not.toContain('>Tee shot<');
    expect(play).not.toContain('Mark shot</Text>');
    expect(play).not.toContain('shotChips');
    expect(play).toContain('applySheet.current(true)');
    expect(map).toContain('props.creditLeft != null');
    expect(map).toContain('aerialPhotoCredit');
    expect(map).toContain('props.aerialNote');
  });
});
