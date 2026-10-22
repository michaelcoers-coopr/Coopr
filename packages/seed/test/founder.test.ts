import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { exportJson, exportMeasurementsCsv, orderedLines, scoreRound } from '@coopr/engine';
import { FOUNDER_RAW, founderFlows, loadFounderDataset } from '@coopr/seed';

const fixture = readFileSync(fileURLToPath(new URL('../fixtures/founder-raw-data.md', import.meta.url)), 'utf8');
const dataset = loadFounderDataset();
const flows = founderFlows(dataset);

function club(key: string) {
  const found = dataset.clubs.find((item) => item.stableKey === key && !item.historicalOnly);
  if (!found) throw new Error(key);
  return found;
}

describe('verbatim founder import', () => {
  it('stores the raw transcript unchanged beside the normalized rows', () => {
    expect(FOUNDER_RAW).toBe(fixture);
    expect(dataset.rawRecords[0]?.body).toBe(fixture);
    expect(dataset.user.audience).toBe('private');
    expect(dataset.user.displayName).toBe('Mike Coers');
    expect(dataset.player.dominantHand).toBe('right');
    expect(dataset.player.dominantHandConfirmedOn).toBe('2026-10-22');
    expect(dataset.player.handicapValue).toBeNull();
    expect(dataset.player.handicapOfficial).toBe(false);
    expect(dataset.caddie.name).toBe('');
    expect(dataset.caddie.personality).toBe('funny_knowledgeable');
  });

  it('keeps 5-iron through AW distances as totals and does not invent carry', () => {
    for (const key of ['5i', '6i', '7i', '8i', '9i', 'aw49']) {
      const rows = dataset.measurements.filter(
        (measurement) => measurement.clubId === club(key).id && measurement.aggregation === 'shot',
      );
      expect(rows.every((measurement) => measurement.metric === 'total')).toBe(true);
      expect(rows.some((measurement) => measurement.metric === 'carry')).toBe(false);
      expect(rows.every((measurement) => measurement.convertedFromMetric == null)).toBe(true);
    }
    const five = dataset.measurements
      .filter((measurement) => measurement.clubId === club('5i').id && measurement.metric === 'total')
      .map((measurement) => measurement.valueNum);
    expect(five).toEqual([132.8, 80.6, 171.9, 184.7, 119.9, 184.5, 152.2, 184.4, 74.4, 183.0]);
    const profile = flows.profiles.find((item) => item.clubId === club('5i').id && item.metric === 'total');
    expect(profile?.p50).toBeCloseTo(162.05, 5);
    expect(flows.profiles.some((item) => item.clubId === club('5i').id && item.metric === 'carry')).toBe(false);
  });

  it('flags the known transcript discrepancies and leaves unknowns null', () => {
    const codes = dataset.discrepancies.map((item) => item.code);
    for (const code of [
      'EIGHT_IRON_11_VS_10',
      'DRIVER_SHOTS_1_2_ABSENT',
      'RATING_SLOPE_UNVERIFIED',
      'DISPLAYED_NET_UNVERIFIED',
      'MIURA48_USABLE_CRITERIA_UNKNOWN',
      'FOUR_WOOD_OWNERSHIP_UNVERIFIED',
      'IN_PLAY_BAG_UNRESOLVED',
      'HISTORICAL_FLEX_SLOT_UNRESOLVED',
    ]) {
      expect(codes).toContain(code);
    }
    const eight = dataset.measurements.filter(
      (measurement) => measurement.clubId === club('8i').id && measurement.aggregation === 'shot',
    );
    expect(eight).toHaveLength(11);
    const driverShots = dataset.shots.filter((shot) => shot.clubId === club('driver').id).map((shot) => shot.shotNumber);
    expect(driverShots.sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(dataset.round.courseRating).toBeNull();
    expect(dataset.round.slope).toBeNull();
    expect(dataset.ratingCandidates.map((item) => [item.courseRating, item.slope, item.selected])).toEqual([
      [69.1, 113, false],
      [70.1, 115, false],
    ]);
    expect(dataset.round.displayedNet).toBe(78);
    expect(dataset.round.displayedNetQuality).toBe('provisional');
    expect(dataset.calibration.applyAutomatically).toBe(false);
    expect(dataset.calibration.status).toBe('suspected');
    expect(club('4w').ownership).toBe('unverified');
    expect(club('3w').ownership).toBe('not_owned');
    expect(club('putter').brand).toBeNull();
    expect(club('pw').brand).toBeNull();
    expect(dataset.bags.find((bag) => bag.kind === 'in_play')).toBeTruthy();
    expect(dataset.memberships.some((membership) => membership.bagId === dataset.bags.find((bag) => bag.kind === 'in_play')?.id)).toBe(
      false,
    );
  });

  it('does not apply the simulator bias to any stored yardage', () => {
    const totals = dataset.measurements.filter((measurement) => measurement.clubId === club('5i').id).map((m) => m.valueNum);
    expect(totals).toContain(132.8);
    expect(totals).not.toContain(142.8);
    expect(totals).not.toContain(147.8);
  });
});

describe('founder rules the engines must keep', () => {
  it('scores High Cedars 105 with 52 out and 53 in', () => {
    const score = scoreRound(dataset.holeScores.map((hole) => ({ hole: hole.holeNumber, strokes: hole.strokes })));
    expect(score).toMatchObject({ gross: 105, front: 52, back: 53 });
    expect(dataset.round.statedGross).toBe(105);
    expect(dataset.round.statedFront).toBe(52);
    expect(dataset.round.statedBack).toBe(53);
    expect(dataset.holeScores.every((hole) => hole.par == null)).toBe(true);
  });

  it('stores 17 club uses and none of them are calibration eligible', () => {
    expect(dataset.clubUses).toHaveLength(17);
    expect(dataset.clubUses.every((use) => use.calibrationEligible === false)).toBe(true);
    expect(dataset.clubUses.every((use) => use.outcome == null)).toBe(true);
    expect(dataset.shots.some((shot) => dataset.clubUses.some((use) => use.id === shot.id))).toBe(false);
  });

  it('does not treat the 357 yard GPS estimate as a shot or a carry', () => {
    const tee = dataset.gpsObservations.find((row) => row.holeNumber === 18 && row.distanceYards === 357);
    expect(tee).toMatchObject({ kind: 'app_tee_estimate', isShot: false, quality: 'estimated' });
    expect(dataset.shots.some((shot) => shot.rawText.includes('357'))).toBe(false);
    expect(dataset.measurements.some((measurement) => measurement.valueNum === 357)).toBe(false);
    expect(dataset.gpsObservations.every((row) => row.isShot === false)).toBe(true);
  });

  it('does not treat 220 as the driver stock carry', () => {
    const driver = flows.profiles.find((profile) => profile.clubId === club('driver').id && profile.metric === 'carry');
    expect(driver).toBeTruthy();
    expect(driver?.stockYards).toBeCloseTo(186.3, 5);
    expect(driver?.longestYards).toBe(220.8);
    expect(driver?.stockYards).not.toBe(220);
    expect(driver?.stockYards).not.toBe(driver?.longestYards);
    expect(driver?.environment).toBe('simulator');
    expect(driver?.swingMode).toBe('unknown');
  });
});

describe('founder verification flows', () => {
  it('chooses a 100 yard wedge without inventing a 54 or a carry', () => {
    const card = flows.wedge100;
    expect(card.posture).toBe('conservative');
    expect(card.clubLabel).toBe('AW 49°');
    expect(card.expectedCarry).toBeNull();
    expect(card.expectedTotal?.p50).toBeCloseTo(109.4, 1);
    expect(card.lines.expected).toMatch(/carry unknown/);
    expect(card.lines.instruction).toMatch(/Do not use this total to clear a hazard/);
    expect(card.lines.reason).toMatch(/criteria are unknown/);
    expect(card.recommendedAim).toBe(card.strategicTarget);
    expect(orderedLines(card).join('\n')).not.toMatch(/\d+(\.\d+)?%/);
    expect(card.clubLabel).not.toBe('54°');
  });

  it('declines a 174 yard carry when the 5-iron is totals only and the hybrids are empty', () => {
    const card = flows.par3Carry174;
    expect(card.posture).toBe('decline');
    expect(card.clubId).toBeNull();
    expect(card.expectedCarry).toBeNull();
    expect(card.lines.reason).toMatch(/5-iron total median/);
    expect(card.lines.reason).toMatch(/not a carry/);
    expect(card.lines.reason).toMatch(/2H/);
    expect(card.lines.reason).toMatch(/4H/);
    expect(card.lines.keyRisk.toLowerCase()).toMatch(/front of the green/);
    expect(card.lines.instruction).toMatch(/Do not substitute a total/);
    expect(orderedLines(card)[0]).toMatch(/^Distance: 174 yards \(carry\)/);
  });

  it('leaves the 41 yard 54° pitch uncalibrated and asks for a recorded outcome', () => {
    const card = flows.pitch41;
    expect(card.posture).toBe('decline');
    expect(card.clubLabel).toBe('54°');
    expect(card.swingMode).toBe('pitch');
    expect(card.expectedCarry).toBeNull();
    expect(card.expectedTotal).toBeNull();
    expect(card.lines.expected).toBe('carry unknown; total unknown');
    expect(card.lines.instruction).toMatch(/Record the carry and the total/);
    expect(card.lines.keyRisk).toMatch(/Uncalibrated/);
    expect(orderedLines(card).join('\n')).not.toMatch(/expected carry 41/i);
  });

  it('names the 5-iron as the club to test-replace and stays brand neutral', () => {
    expect(flows.replace.clubId).toBe(club('5i').id);
    expect(flows.replace.brandNeutral).toBe(true);
    expect(flows.replace.alsoUnreliable.map((item) => item.clubLabel)).toContain('6-iron');
    expect(flows.replace.reason).not.toMatch(/G440|Srixon|Ping|Callaway|TaylorMade|Odyssey|Cleveland|Miura/);
    expect(dataset.clubs.some((item) => item.historicalOnly && item.model === 'G440 Max')).toBe(true);
  });
});

describe('export', () => {
  it('writes JSON and CSV without turning a 5-iron total into a carry', () => {
    const measurements = dataset.measurements.map((measurement) => ({
      id: measurement.id,
      clubId: measurement.clubId,
      shotId: measurement.shotId,
      metric: measurement.metric,
      valueNum: measurement.valueNum,
      valueText: measurement.valueText,
      unit: measurement.unit,
      quality: measurement.quality,
      aggregation: measurement.aggregation,
      convertedFromMetric: measurement.convertedFromMetric,
      deletedAtMs: measurement.deletedAtMs,
    }));
    const json = exportJson({
      exportedAtMs: 0,
      userId: dataset.user.id,
      displayName: dataset.user.displayName,
      audience: dataset.user.audience,
      raw: dataset.rawRecords[0]?.body ?? '',
      measurements,
      discrepancies: dataset.discrepancies,
    });
    expect(json).toContain('Mike Coers');
    expect(json).toContain(fixture.slice(0, 40));
    const csv = exportMeasurementsCsv(measurements);
    const fiveRows = csv.split('\n').filter((line) => line.includes(club('5i').id));
    expect(fiveRows.length).toBeGreaterThan(0);
    expect(fiveRows.every((line) => line.includes(',total,'))).toBe(true);
    expect(fiveRows.some((line) => line.includes(',carry,'))).toBe(false);
  });
});
