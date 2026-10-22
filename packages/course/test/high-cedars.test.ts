import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveCourse } from '@coopr/engine';
import { highCedarsProviders, loadHighCedarsPilot, renderPilotReport } from '@coopr/course';

const pilot = loadHighCedarsPilot();

describe('High Cedars open data', () => {
  it('uses the real scorecard and does not invent OpenGolfAPI geometry', () => {
    expect(pilot.record.name).toBe('Cedars At High Cedars Golf Club');
    expect(pilot.record.locality).toBe('Orting');
    expect(pilot.record.region).toBe('WA');
    expect(pilot.record.scorecard).toHaveLength(18);
    expect(pilot.record.scorecard.reduce((sum, hole) => sum + (hole.par ?? 0), 0)).toBe(72);
    expect(pilot.record.attribution).toMatch(/OpenStreetMap contributors/);
    expect(pilot.record.attribution).toMatch(/OpenGolfAPI/);
    expect(pilot.executiveHoleWays).toBe(9);
    expect(pilot.discrepancies.join(' ')).toMatch(/5577/);
    expect(pilot.discrepancies.join(' ')).toMatch(/5579/);
    const first = pilot.quality[0];
    expect(first).toMatchObject({ holeNumber: 1, par: 5, strokeIndex: 7, verification: 'unverified', namedTeeCoordinates: false });
    expect(first?.yardagesByTee.white).toBe(484);
    expect(pilot.quality.every((hole) => hole.verification === 'unverified')).toBe(true);
    expect(pilot.quality.every((hole) => hole.bunkersTaggedToHole === 0 && hole.hazardsTaggedToHole === 0)).toBe(true);
  });

  it('keeps the commercial adapter empty and the written report equal to the fixture', async () => {
    const providers = highCedarsProviders();
    const resolved = await resolveCourse({
      courseKey: pilot.courseKey,
      externalId: pilot.record.externalId,
      ...providers,
    });
    expect(resolved.scorecard?.name).toBe(pilot.record.name);
    expect(resolved.geometry.length).toBeGreaterThan(0);
    expect(resolved.geometry.every((feature) => feature.provenance.datasetClass === 'open')).toBe(true);
    expect(resolved.commercialFeatures).toEqual([]);
    expect(providers.commercial.state).toBe('partner_required');
    const docPath = fileURLToPath(new URL('../../../docs/COURSE_DATA.md', import.meta.url));
    expect(readFileSync(docPath, 'utf8')).toBe(renderPilotReport(pilot));
  });
});
