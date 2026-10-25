import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analyze } from '@coopr/analysis';
import { archiveRound, readArchive } from '../src/analysis/archive';
import { hydrateDevice, resetDeviceForTests } from '../src/device-store';
import { openRound, storedShots, toEngine, type StoredRound } from '../src/analysis/from-round';
import { presentAnalysis } from '../src/analysis/present';
import { sampleBundle } from '../src/analysis/sample-season';
import { sampleBundle as sampleOff } from '../src/analysis/sample-season-off';

const here = dirname(fileURLToPath(import.meta.url));

function memoryStorage(): void {
  const map = new Map<string, string>();
  const store = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true });
}

function roundWith(penalties: number | null): StoredRound {
  return {
    id: 'r1',
    playedOn: '2026-10-25',
    courseName: 'High Cedars',
    holes: [{ number: 1, par: 4, yards: 380, strokeIndex: 7, strokes: 5, putts: 2, penalties }],
  };
}

describe('analysis states', () => {
  it('shows an invitation and no figure when nothing has been logged', () => {
    const panels = presentAnalysis(analyze({ rounds: [], shots: [] }));
    expect(panels).toHaveLength(6);
    for (const panel of panels) {
      expect(panel.figure).toBeNull();
      expect(panel.sample).toBe(false);
      expect(panel.invitation).toBeTruthy();
    }
  });

  it('asks for more holes from one complete hole and keeps a missing penalty null', () => {
    const ready = toEngine([roundWith(0)], []);
    expect(ready.rounds[0]?.isSample).toBe(false);
    expect(ready.rounds[0]?.holes[0]?.penalties).toBe(0);
    const panels = presentAnalysis(analyze({ rounds: ready.rounds, shots: ready.shots }));
    const home = panels.find((panel) => panel.id === 'one_fix');
    const ledger = panels.find((panel) => panel.id === 'loss_ledger');
    expect(home?.status).toBe('needs_more');
    expect(home?.figure).toBeNull();
    expect(home?.invitation).toMatch(/Needs/);
    expect(home?.invitation).not.toMatch(/log putts and penalties/);
    expect(ledger?.status).toBe('needs_more');
    expect(ledger?.figure).toBeNull();
    expect(ledger?.invitation).toMatch(/Needs/);

    const missing = toEngine([roundWith(null)], []);
    expect(missing.rounds[0]?.holes[0]?.penalties).toBe(0);
    expect(roundWith(null).holes[0]?.penalties).toBeNull();
    const withheld = presentAnalysis(analyze({ rounds: missing.rounds, shots: missing.shots }));
    expect(withheld.every((panel) => panel.figure == null)).toBe(true);

    const mapped = toEngine([], storedShots([{ id: 's1', clubLabel: '7-iron', environment: 'range', carry: 150, total: null, origin: 'manual' }]));
    expect(mapped.shots[0]?.isSample).toBe(false);
    expect(mapped.shots[0]?.carryQuality).toBe('user_confirmed');
    expect(mapped.shots[0]?.carryYds).toBe(150);
    expect(mapped.shots[0]?.lateralYds).toBeNull();
  });

  it('labels the synthetic season Sample and shows a ready fix', () => {
    const sample = sampleBundle();
    const panels = presentAnalysis(analyze({ rounds: sample.rounds, shots: sample.shots }));
    const home = panels[0];
    expect(home?.status).toBe('ready');
    expect(home?.sample).toBe(true);
    expect(home?.figure).toMatch(/^\d/);
    expect(home?.fixId).toBeTruthy();
    expect(panels.filter((panel) => panel.figure != null).every((panel) => panel.sample)).toBe(true);
    for (const panel of panels) {
      if (panel.status !== 'ready') expect(panel.figure).toBeNull();
    }
  });

  it('keeps the sample season out of the friends bundle path and the screen source', () => {
    expect(sampleOff()).toBeNull();
    const screen = readFileSync(join(here, '../app/analysis.tsx'), 'utf8');
    const metro = readFileSync(join(here, '../metro.config.js'), 'utf8');
    expect(screen).toContain('presentAnalysis');
    expect(screen).not.toContain('7.2');
    expect(screen).not.toContain('Sample Sam');
    expect(screen).not.toContain('approach_short_game');
    expect(screen).not.toContain('allowSyntheticBaseline');
    expect(metro).toContain('sample-season-off.ts');
    expect(readFileSync(join(here, '../app/index.tsx'), 'utf8')).toContain("router.push('/analysis')");
    expect(readFileSync(join(here, '../app/play.tsx'), 'utf8')).toContain('accessibilityLabel="Analysis"');
    expect(readFileSync(join(here, '../app/more.tsx'), 'utf8')).toContain("router.push('/analysis')");
  });

  it('archives a finished round and leaves a blank penalty null', () => {
    memoryStorage();
    resetDeviceForTests();
    hydrateDevice();
    const open = openRound({
      holes: [5, ...Array<number | null>(17).fill(null)],
      putts: [2, ...Array<number | null>(17).fill(null)],
      penalties: [null, ...Array<number | null>(17).fill(null)],
      playedOn: '2026-10-25',
      courseName: 'High Cedars',
      card: [{ holeNumber: 1, par: 4, strokeIndex: 7, yards: 380 }],
    });
    expect(open?.holes[0]?.penalties).toBeNull();
    archiveRound(open!);
    const saved = readArchive();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.id).not.toBe('open');
    expect(saved[0]?.holes[0]?.penalties).toBeNull();
    expect(saved[0]?.holes[0]?.strokes).toBe(5);
    expect(saved[0]?.holes[0]?.putts).toBe(2);
  });
});
