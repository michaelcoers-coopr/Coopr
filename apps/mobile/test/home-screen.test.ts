import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const home = readFileSync(join(here, '../app/index.tsx'), 'utf8');

describe('home tee sheet', () => {
  it('keeps the tee-it-up closed state and the tee sheet, without invented weather', () => {
    expect(home).toContain('TEE');
    expect(home).toContain('START ROUND');
    expect(home).toContain('RESUME ROUND');
    expect(home).toContain('Waiting on the sky');
    expect(home).toContain('Foursome games');
    expect(home).toContain("router.push('/games')");
    expect(home).not.toContain('Coming to the TestFlight build.');
    expect(home).toContain('No rounds yet. Your first one lands here.');
    expect(home).toContain("router.push('/more')");
    expect(home).toContain("router.push('/play')");
    expect(home).toContain("router.push('/bag')");
    expect(home).toContain('labels={[]}');
    expect(home).toContain('coursePill(');
    expect(home).toContain("started ? 'NEXT HOLE' : 'FIRST HOLE'");
    expect(home).toContain('summary.kept >= 3 && summary.lastKept?.gross != null');
    expect(home).toContain("router.push('/rounds')");
    expect(home).toContain('foldSnap(');
    expect(home).toContain("backgroundColor: '#02060E'");
    expect(home).toContain('displayName.trim()');
    expect(home).not.toContain("Let's go, Mike");
    expect(home).not.toContain('White tees');
    expect(home).not.toContain('57°');
    expect(home).not.toContain('2 mph');
  });
});
