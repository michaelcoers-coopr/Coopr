import {
  SCHEMA_VERSION,
  createIdFactory,
  type Bag,
  type BagMembership,
  type Calibration,
  type Club,
  type ClubNote,
  type ClubUseObservation,
  type DataSource,
  type Discrepancy,
  type FounderDataset,
  type GpsObservation,
  type HoleScore,
  type RatingCandidate,
  type Round,
  type Shot,
  type ShotMeasurement,
  type SimulatorSession,
} from '@coopr/domain';

interface Options {
  /** Sync clock for the import rows. Not an event time from the source. */
  importedAtMs: number;
}

/**
 * Parse the verbatim founder transcript into normalized rows.
 * Unknowns stay null. Totals are never written as carry. The raw text is kept whole.
 */
export function importFounder(raw: string, options: Options): FounderDataset {
  const next = createIdFactory(options.importedAtMs);
  const stamp = () => ({
    createdAtMs: options.importedAtMs,
    updatedAtMs: options.importedAtMs,
    deletedAtMs: null,
  });
  const discrepancies: Discrepancy[] = [];
  const flag = (code: string, detail: string) => discrepancies.push({ code, detail });

  const userId = next();
  const sourceId = next();
  const source: DataSource = {
    ...stamp(),
    id: sourceId,
    userId,
    kind: 'founder_verbatim',
    ref: 'packages/seed/fixtures/founder-raw-data.md',
    capturedOn: null,
    quality: 'measured',
    note: 'Line items come from the verbatim transcript. The import brief calls the session TrackMan; the file does not name the monitor brand. Environment is simulator because the same transcript states a simulator-bias hypothesis.',
  };

  const clubs: Club[] = [];
  const addClub = (club: Omit<Club, 'id' | 'userId' | 'createdAtMs' | 'updatedAtMs' | 'deletedAtMs'>): Club => {
    const row: Club = { ...stamp(), ...club, id: next(), userId };
    clubs.push(row);
    return row;
  };
  const live = (key: string): Club => {
    const club = clubs.find((item) => item.stableKey === key && !item.historicalOnly);
    if (!club) throw new Error(`Club ${key} was not parsed from the bag`);
    return club;
  };

  let handed: { hand: 'right' | 'left'; on: string } | null = null;
  let roundHeader: {
    courseName: string;
    location: string;
    playedOn: string;
    teeName: string;
    yardage: number;
    par: number;
    ratings: Array<{ courseRating: number; slope: number }>;
  } | null = null;
  let roundTotals: { gross: number; plus: number; net: number; front: number; back: number } | null = null;
  let holeStrokes: number[] | null = null;
  const gps: Array<Omit<GpsObservation, 'id' | 'userId' | 'roundId' | 'createdAtMs' | 'updatedAtMs' | 'deletedAtMs'>> = [];
  const uses: Array<{ hole: number; dist: number; key: string; mode: string; raw: string }> = [];
  const shots: Shot[] = [];
  const measurements: ShotMeasurement[] = [];
  const notes: ClubNote[] = [];
  let session: SimulatorSession | null = null;
  let calibration: Calibration | null = null;
  const historicalKeys: string[] = [];

  const measure = (row: {
    shotId: string | null;
    clubId: string;
    sessionId: string | null;
    metric: string;
    valueNum: number | null;
    valueText?: string | null;
    unit: string | null;
    quality: ShotMeasurement['quality'];
    aggregation: ShotMeasurement['aggregation'];
  }) => {
    if (row.valueNum == null && (row.valueText == null || row.valueText === '')) return;
    measurements.push({
      ...stamp(),
      id: next(),
      userId,
      shotId: row.shotId,
      clubId: row.clubId,
      sessionId: row.sessionId,
      metric: row.metric,
      valueNum: row.valueNum,
      valueText: row.valueText ?? null,
      unit: row.unit,
      quality: row.quality,
      aggregation: row.aggregation,
      sourceId,
      convertedFromMetric: null,
    });
  };

  const ensureSession = (): SimulatorSession => {
    if (session) return session;
    session = {
      ...stamp(),
      id: next(),
      userId,
      environment: 'simulator',
      label: 'Founder launch-monitor transcript',
      validationRequired: false,
      validationNote: null,
    };
    return session;
  };

  const addShot = (club: Club, shotNumber: number | null, rawText: string): Shot => {
    const current = ensureSession();
    const shot: Shot = {
      ...stamp(),
      id: next(),
      userId,
      clubId: club.id,
      sessionId: current.id,
      environment: 'simulator',
      swingMode: 'unknown',
      shotNumber,
      qualityLabel: 'unknown',
      calibrationEligible: true,
      sourceId,
      rawText,
      note: null,
    };
    shots.push(shot);
    return shot;
  };

  const num = (token: string, context: string): number | null => {
    const trimmed = token.trim();
    if (trimmed === 'null') return null;
    if (!/^[+-]?(?:\d+\.\d+|\d+)$/.test(trimmed)) throw new Error(`Unparsed number "${trimmed}" in ${context}`);
    return Number(trimmed);
  };

  const lines = raw.endsWith('\n') ? raw.slice(0, -1).split('\n') : raw.split('\n');
  let section = 'preamble';

  const brandModel = (text: string): { brand: string | null; model: string | null } => {
    const known = ['Callaway', 'Cleveland', 'PXG', 'Miura', 'Srixon', 'Odyssey'];
    for (const brand of known) {
      if (text === brand) return { brand, model: null };
      if (text.startsWith(`${brand} `)) return { brand, model: text.slice(brand.length + 1) };
    }
    return { brand: null, model: text.length > 0 ? text : null };
  };

  const baseClub = (
    stableKey: string,
    label: string,
    category: Club['category'],
    rawText: string,
    extra: Partial<Club> = {},
  ) =>
    addClub({
      stableKey,
      label,
      category,
      loftDeg: null,
      bounceDeg: null,
      brand: null,
      model: null,
      flex: 'stiff',
      shaftModel: null,
      shaftMaterial: null,
      ownership: 'owned',
      historicalOnly: false,
      rawText,
      ...extra,
    });

  for (const line of lines) {
    if (line.startsWith('# ')) {
      if (!line.startsWith('# Founder raw data')) throw new Error(`Unexpected title: ${line}`);
      continue;
    }
    if (line.startsWith('## ')) {
      if (line.startsWith('## Bag')) section = 'bag';
      else if (line.startsWith('## Driver 10-shot averages')) section = 'driver_avg';
      else if (line.startsWith('## Driver visible shots')) section = 'driver_shots';
      else if (line.startsWith('## Iron/wedge TOTAL')) section = 'irons';
      else if (line.startsWith('## Miura 48')) section = 'miura48';
      else if (line.startsWith('## Miura 56')) section = 'miura56';
      else if (line.startsWith('## Simulator bias:')) {
        section = 'bias';
        const match = /^## Simulator bias: suspected, \+(\d+) to \+(\d+), confidence low, correction_applied false$/.exec(line);
        if (!match?.[1] || !match[2]) throw new Error(`Unparsed bias line: ${line}`);
        calibration = {
          ...stamp(),
          id: next(),
          userId,
          scope: 'simulator_vs_outdoor',
          status: 'suspected',
          deltaLow: Number(match[1]),
          deltaHigh: Number(match[2]),
          confidence: 'low',
          applyAutomatically: false,
          hypothesis: 'Suspected simulator bias of +10 to +15 yards. Not applied.',
          sourceId,
        };
      } else if (line.startsWith('## Round:')) {
        section = 'round';
        const match =
          /^## Round: (.+), (.+), (\d{4}-\d{2}-\d{2}), ([A-Za-z]+), (\d+)yd, par (\d+), rating\/slope provisional \(([\d.]+)\/(\d+) or ([\d.]+)\/(\d+)\)$/.exec(
            line,
          );
        if (!match) throw new Error(`Unparsed round header: ${line}`);
        const ratingA = match[7];
        const slopeA = match[8];
        const ratingB = match[9];
        const slopeB = match[10];
        const course = match[1];
        const location = match[2];
        const playedOn = match[3];
        const tee = match[4];
        const yardage = match[5];
        const par = match[6];
        if (!ratingA || !slopeA || !ratingB || !slopeB || !course || !location || !playedOn || !tee || !yardage || !par) {
          throw new Error(`Unparsed round header: ${line}`);
        }
        roundHeader = {
          courseName: course,
          location,
          playedOn,
          teeName: tee,
          yardage: Number(yardage),
          par: Number(par),
          ratings: [
            { courseRating: Number(ratingA), slope: Number(slopeA) },
            { courseRating: Number(ratingB), slope: Number(slopeB) },
          ],
        };
        flag(
          'RATING_SLOPE_UNVERIFIED',
          `White tee rating/slope is provisional: ${ratingA}/${slopeA} or ${ratingB}/${slopeB}. Neither is selected.`,
        );
      } else if (line.startsWith('## GPS to-center observations')) {
        section = 'gps';
        const body = line.slice(line.indexOf(':') + 1).trim();
        for (const part of body.split('|').map((item) => item.trim())) {
          const match = /^(\d+):([\d,]+)$/.exec(part);
          if (!match?.[1] || !match[2]) throw new Error(`Unparsed GPS observation: ${part}`);
          const hole = Number(match[1]);
          match[2].split(',').forEach((dist, sequence) => {
            gps.push({
              holeNumber: hole,
              sequence,
              kind: 'to_center',
              distanceYards: Number(dist),
              isShot: false,
              quality: 'measured',
              sourceId,
            });
          });
        }
      } else if (line.startsWith('## GPS app tee estimates')) {
        section = 'gps_est';
        const body = line.slice(line.indexOf(':') + 1).trim();
        const found = [...body.matchAll(/(\d+):(\d+)/g)];
        if (found.length === 0) throw new Error(`Unparsed tee estimates: ${line}`);
        found.forEach((match, sequence) => {
          const hole = match[1];
          const dist = match[2];
          if (!hole || !dist) throw new Error('tee estimate');
          gps.push({
            holeNumber: Number(hole),
            sequence,
            kind: 'app_tee_estimate',
            distanceYards: Number(dist),
            isShot: false,
            quality: 'estimated',
            sourceId,
          });
        });
        flag('GPS_TEE_ESTIMATES_UNVERIFIED', 'App tee estimates are marked estimated and are not shots. 357 yards on 18 is one of them.');
      } else if (line.startsWith('## User-confirmed club use')) {
        section = 'uses';
      } else if (line.startsWith('## Subjective:')) {
        section = 'subjective';
        const body = line.slice('## Subjective:'.length).trim();
        if (body !== '2H felt poor; 4H better than 3H; more confidence in 4H.') {
          throw new Error(`Unexpected subjective line: ${body}`);
        }
        const note = (key: string, bodyText: string) =>
          notes.push({
            ...stamp(),
            id: next(),
            userId,
            clubId: live(key).id,
            body: bodyText,
            quality: 'user_confirmed',
            sourceId,
          });
        note('2h', 'Felt poor. Subjective only — not a measurement.');
        note('4h', 'Better than the 3H, with more confidence. Subjective only — not a measurement.');
      } else if (line.startsWith('## Historical ideal bag')) {
        section = 'historical';
        const body = line.slice(line.indexOf(':') + 1).trim();
        const parts = body.split(', ');
        const expect = [
          'G440 Max 10.5 D',
          'G440 Max 4W 17',
          'G440 4H 23',
          'G440 5H 26',
          'Srixon ZXiR 6-PW',
          'Cleveland CBZ 48/54/58',
          'putter high-MOI (Odyssey S2S Max test)',
          'flex slot existing 4H or gapped FW (duplicate to resolve)',
        ];
        if (parts.join(', ') !== expect.join(', ')) throw new Error(`Unexpected historical bag: ${body}`);
        const hist = (
          key: string,
          label: string,
          category: Club['category'],
          rawText: string,
          extra: Partial<Club> = {},
        ) => {
          historicalKeys.push(key);
          return baseClub(key, label, category, rawText, {
            ownership: 'not_owned',
            historicalOnly: true,
            flex: null,
            ...extra,
          });
        };
        hist('hist-driver', 'G440 Max driver', 'driver', 'G440 Max 10.5 D', { loftDeg: 10.5, model: 'G440 Max' });
        hist('hist-4w', 'G440 Max 4W', 'wood', 'G440 Max 4W 17', { loftDeg: 17, model: 'G440 Max' });
        hist('hist-4h', 'G440 4H', 'hybrid', 'G440 4H 23', { loftDeg: 23, model: 'G440' });
        hist('hist-5h', 'G440 5H', 'hybrid', 'G440 5H 26', { loftDeg: 26, model: 'G440' });
        for (const iron of [6, 7, 8, 9]) {
          hist(`hist-${iron}i`, `ZXiR ${iron}-iron`, 'iron', 'Srixon ZXiR 6-PW', { brand: 'Srixon', model: 'ZXiR' });
        }
        hist('hist-pw', 'ZXiR PW', 'wedge', 'Srixon ZXiR 6-PW', { brand: 'Srixon', model: 'ZXiR' });
        for (const loft of [48, 54, 58]) {
          hist(`hist-w${loft}`, `CBZ ${loft}°`, 'wedge', 'Cleveland CBZ 48/54/58', {
            loftDeg: loft,
            brand: 'Cleveland',
            model: 'CBZ',
          });
        }
        hist('hist-putter', 'High-MOI putter', 'putter', 'putter high-MOI (Odyssey S2S Max test)', {
          brand: 'Odyssey',
          model: 'S2S Max',
        });
        flag(
          'HISTORICAL_FLEX_SLOT_UNRESOLVED',
          'Historical bag flex slot is "existing 4H or gapped FW" and is not stored as a club. The historical bag is history only.',
        );
      } else {
        throw new Error(`Unknown section header: ${line}`);
      }
      continue;
    }

    if (section === 'preamble') {
      const match = /^Handedness: (right|left) \(user confirmed (\d{4}-\d{2}-\d{2})\)\.$/.exec(line);
      if (!match?.[1] || !match[2]) throw new Error(`Unparsed preamble: ${line}`);
      handed = { hand: match[1] as 'right' | 'left', on: match[2] };
      continue;
    }

    if (section === 'bag') {
      const parts = line.split(' | ');
      if (parts.length !== 15) throw new Error(`Expected 15 bag segments, found ${parts.length}`);
      const take = (index: number): string => {
        const value = parts[index];
        if (value === undefined) throw new Error('bag segment');
        return value;
      };
      const driver = /^Driver (.+) stiff$/.exec(take(0));
      if (!driver?.[1]) throw new Error(take(0));
      const driverBrand = brandModel(driver[1]);
      baseClub('driver', 'Driver', 'driver', take(0), driverBrand);

      if (take(1) !== '3W not owned') throw new Error(take(1));
      baseClub('3w', '3W', 'wood', take(1), { ownership: 'not_owned', flex: null, model: null });

      const fourW = /^4W (.+) \(verify ownership\)$/.exec(take(2));
      if (!fourW?.[1]) throw new Error(take(2));
      baseClub('4w', '4W', 'wood', take(2), { ...brandModel(fourW[1]), ownership: 'unverified' });
      flag('FOUR_WOOD_OWNERSHIP_UNVERIFIED', '4W Callaway Steelhead XR is listed with verify ownership. It is not in the in-play bag.');

      const twoH = /^2H (.+) \(model\/loft verify\)$/.exec(take(3));
      if (!twoH?.[1]) throw new Error(take(3));
      baseClub('2h', '2H', 'hybrid', take(3), brandModel(twoH[1]));
      flag('HYBRID_2H_MODEL_UNVERIFIED', '2H model and loft are unverified.');

      const threeH = /^3H (.+) \((\d+) or (\d+) verify\)$/.exec(take(4));
      if (!threeH?.[1] || !threeH[2] || !threeH[3]) throw new Error(take(4));
      baseClub('3h', '3H', 'hybrid', take(4), brandModel(threeH[1]));
      flag('HYBRID_3H_LOFT_UNVERIFIED', `3H loft is ${threeH[2]} or ${threeH[3]}. Neither is selected.`);

      const fourH = /^4H (.+) \(preferred\)$/.exec(take(5));
      if (!fourH?.[1]) throw new Error(take(5));
      baseClub('4h', '4H', 'hybrid', take(5), brandModel(fourH[1]));

      const threeI = /^3i utility (\S+) loft unknown$/.exec(take(6));
      if (!threeI?.[1]) throw new Error(take(6));
      baseClub('3i', '3i utility', 'utility', take(6), brandModel(threeI[1]));
      flag('THREE_IRON_LOFT_UNKNOWN', 'PXG 3-iron utility loft is unknown.');

      const irons = /^5i-9i (.+) stiff$/.exec(take(7));
      if (!irons?.[1]) throw new Error(take(7));
      const ironBrand = brandModel(irons[1]);
      for (const n of [5, 6, 7, 8, 9]) {
        baseClub(`${n}i`, `${n}-iron`, 'iron', take(7), ironBrand);
      }

      const pw = /^PW (.+) (\d+)$/.exec(take(8));
      if (!pw?.[1] || !pw[2]) throw new Error(take(8));
      baseClub('pw', 'PW', 'wedge', take(8), { ...brandModel(pw[1]), loftDeg: Number(pw[2]) });
      flag('PW_BRAND_NOT_ON_LINE', 'PW line names Steelhead XR and 44° but does not repeat a brand. Brand is left null.');

      const aw = /^AW (.+) (\d+)$/.exec(take(9));
      if (!aw?.[1] || !aw[2]) throw new Error(take(9));
      baseClub('aw49', 'AW 49°', 'wedge', take(9), { ...brandModel(aw[1]), loftDeg: Number(aw[2]) });

      const m48 = /^Miura (\d+) stiff steel$/.exec(take(10));
      if (!m48?.[1]) throw new Error(take(10));
      baseClub('miura48', 'Miura 48°', 'wedge', take(10), {
        brand: 'Miura',
        loftDeg: Number(m48[1]),
        shaftMaterial: 'steel',
      });

      const w54 = /^SW (.+) (\d+)\/(\d+)$/.exec(take(11));
      if (!w54?.[1] || !w54[2] || !w54[3]) throw new Error(take(11));
      baseClub('w54', '54°', 'wedge', take(11), { ...brandModel(w54[1]), loftDeg: Number(w54[2]), bounceDeg: Number(w54[3]) });

      const m56 = /^SW Miura (\d+) stiff steel$/.exec(take(12));
      if (!m56?.[1]) throw new Error(take(12));
      baseClub('miura56', 'Miura 56°', 'wedge', take(12), {
        brand: 'Miura',
        loftDeg: Number(m56[1]),
        shaftMaterial: 'steel',
      });

      const w58 = /^LW (.+) (\d+)\/(\d+)$/.exec(take(13));
      if (!w58?.[1] || !w58[2] || !w58[3]) throw new Error(take(13));
      baseClub('w58', '58°', 'wedge', take(13), { ...brandModel(w58[1]), loftDeg: Number(w58[2]), bounceDeg: Number(w58[3]) });

      if (take(14) !== 'Putter unknown') throw new Error(take(14));
      baseClub('putter', 'Putter', 'putter', take(14), { flex: null });
      flag('PUTTER_UNKNOWN', 'Putter brand, model, and shaft are unknown.');
      section = 'bag_done';
      continue;
    }

    if (section === 'driver_avg') {
      const match =
        /^carry ([\d.]+), total ([\d.]+), club speed ([\d.]+), ball ([\d.]+), smash ([\d.]+), spin (\d+), attack ([+-][\d.]+), path ([+-][\d.]+), face ([+-][\d.]+), face-to-path ([+-][\d.]+), launch ([\d.]+), carry side (\d+ft\d+in left), carry dispersion ±(\d+)yd, total dispersion ±(\d+)yd$/.exec(
          line,
        );
      if (!match) throw new Error(`Unparsed driver averages: ${line}`);
      const fields: Array<{ metric: string; value: string | undefined; unit: string }> = [
        { metric: 'carry', value: match[1], unit: 'yards' },
        { metric: 'total', value: match[2], unit: 'yards' },
        { metric: 'club_speed', value: match[3], unit: 'mph' },
        { metric: 'ball_speed', value: match[4], unit: 'mph' },
        { metric: 'smash', value: match[5], unit: null as unknown as string },
        { metric: 'spin', value: match[6], unit: 'rpm' },
        { metric: 'attack', value: match[7], unit: 'degrees' },
        { metric: 'path', value: match[8], unit: 'degrees' },
        { metric: 'face', value: match[9], unit: 'degrees' },
        { metric: 'face_to_path', value: match[10], unit: 'degrees' },
        { metric: 'launch', value: match[11], unit: 'degrees' },
      ];
      const current = ensureSession();
      const driver = live('driver');
      for (const field of fields) {
        if (!field.value) throw new Error('driver average field');
        measure({
          shotId: null,
          clubId: driver.id,
          sessionId: current.id,
          metric: field.metric,
          valueNum: Number(field.value),
          unit: field.unit,
          quality: 'derived',
          aggregation: 'session_average',
        });
      }
      const side = match[12];
      const carryDisp = match[13];
      const totalDisp = match[14];
      if (!side || !carryDisp || !totalDisp) throw new Error('driver dispersion');
      measure({
        shotId: null,
        clubId: driver.id,
        sessionId: current.id,
        metric: 'carry_side',
        valueNum: null,
        valueText: side,
        unit: 'ft_in',
        quality: 'derived',
        aggregation: 'session_average',
      });
      measure({
        shotId: null,
        clubId: driver.id,
        sessionId: current.id,
        metric: 'carry_dispersion',
        valueNum: Number(carryDisp),
        valueText: `±${carryDisp}yd`,
        unit: 'yards',
        quality: 'derived',
        aggregation: 'session_average',
      });
      measure({
        shotId: null,
        clubId: driver.id,
        sessionId: current.id,
        metric: 'total_dispersion',
        valueNum: Number(totalDisp),
        valueText: `±${totalDisp}yd`,
        unit: 'yards',
        quality: 'derived',
        aggregation: 'session_average',
      });
      section = 'driver_avg_done';
      continue;
    }

    if (section === 'driver_shots') {
      if (line.startsWith('(shots 1-2')) {
        if (line !== '(shots 1-2 not available; never manufacture)') throw new Error(line);
        flag('DRIVER_SHOTS_1_2_ABSENT', 'Driver shots 1 and 2 are not in the transcript and are not manufactured.');
        continue;
      }
      const match = /^(\d+): (.+)$/.exec(line);
      if (!match?.[1] || !match[2]) throw new Error(`Unparsed driver shot: ${line}`);
      const shotNumber = Number(match[1]);
      if (shotNumber < 3 || shotNumber > 10) throw new Error(`Refusing driver shot number ${shotNumber}`);
      const tokens = match[2].split(',');
      if (tokens.length !== 7) throw new Error(`Driver shot ${shotNumber} field count`);
      const [carryT, totalT, clubT, ballT, smashT, spinT, attackT] = tokens;
      if (!carryT || !totalT || !clubT || !ballT || !smashT || !spinT || !attackT) throw new Error('driver token');
      const shot = addShot(live('driver'), shotNumber, line);
      const pairs: Array<[string, string, string]> = [
        ['carry', carryT, 'yards'],
        ['total', totalT, 'yards'],
        ['club_speed', clubT, 'mph'],
        ['ball_speed', ballT, 'mph'],
        ['smash', smashT, 'ratio'],
        ['spin', spinT, 'rpm'],
        ['attack', attackT, 'degrees'],
      ];
      for (const [metric, token, unit] of pairs) {
        const value = num(token, line);
        if (value == null) continue;
        measure({
          shotId: shot.id,
          clubId: shot.clubId,
          sessionId: shot.sessionId,
          metric,
          valueNum: value,
          unit,
          quality: 'measured',
          aggregation: 'shot',
        });
      }
      continue;
    }

    if (section === 'irons') {
      const match = /^(5i|6i|7i|8i|9i|AW49): ([0-9.,]+)(?: \((.+)\))?$/.exec(line);
      if (!match?.[1] || !match[2]) throw new Error(`Unparsed iron line: ${line}`);
      const key = match[1] === 'AW49' ? 'aw49' : match[1];
      const club = live(key);
      if (match[3]) {
        if (key !== '8i' || !match[3].includes('11 vs noted 10')) throw new Error(match[3]);
        flag('EIGHT_IRON_11_VS_10', '8-iron list contains 11 totals; the note says 10. All 11 are stored. None are dropped.');
        const current = ensureSession();
        current.validationRequired = true;
        current.validationNote = '8-iron count is 11 versus a noted 10.';
      }
      const values = match[2].split(',').map((token) => num(token, line));
      values.forEach((value, index) => {
        if (value == null) throw new Error('null iron total');
        const shot = addShot(club, index + 1, `${match[1]} shot ${index + 1}: ${value} total`);
        measure({
          shotId: shot.id,
          clubId: club.id,
          sessionId: shot.sessionId,
          metric: 'total',
          valueNum: value,
          unit: 'yards',
          quality: 'measured',
          aggregation: 'shot',
        });
      });
      continue;
    }

    if (section === 'miura48') {
      const match =
        /^raw avg carry ([\d.]+), raw avg total ([\d.]+), usable-strike avg carry ([\d.]+), usable avg total ([\d.]+) \(criteria unknown\), best ([\d.]+) carry\/([\d.]+) total$/.exec(
          line,
        );
      if (!match) throw new Error(`Unparsed Miura 48: ${line}`);
      const current = ensureSession();
      const club = live('miura48');
      const rawCarry = match[1];
      const rawTotal = match[2];
      const usableCarry = match[3];
      const usableTotal = match[4];
      const bestCarry = match[5];
      const bestTotal = match[6];
      if (!rawCarry || !rawTotal || !usableCarry || !usableTotal || !bestCarry || !bestTotal) throw new Error('miura 48');
      const add = (metric: 'carry' | 'total', value: string, aggregation: ShotMeasurement['aggregation'], quality: ShotMeasurement['quality']) =>
        measure({
          shotId: null,
          clubId: club.id,
          sessionId: current.id,
          metric,
          valueNum: Number(value),
          unit: 'yards',
          quality,
          aggregation,
        });
      add('carry', rawCarry, 'session_average', 'derived');
      add('total', rawTotal, 'session_average', 'derived');
      add('carry', usableCarry, 'usable_strike_average', 'provisional');
      add('total', usableTotal, 'usable_strike_average', 'provisional');
      add('carry', bestCarry, 'best', 'derived');
      add('total', bestTotal, 'best', 'derived');
      flag('MIURA48_USABLE_CRITERIA_UNKNOWN', 'Miura 48 usable-strike average has unknown inclusion criteria. It is not a shot sample and is not a stock distance.');
      section = 'miura48_done';
      continue;
    }

    if (section === 'miura56') {
      if (line.startsWith('No data:')) {
        if (line !== 'No data: 54, 58, 3i, 2H, 3H, 4H, 4W.') throw new Error(line);
        continue;
      }
      const pairs = line.split(' | ');
      if (pairs.length !== 6) throw new Error(`Expected 6 Miura 56 shots, found ${pairs.length}`);
      const club = live('miura56');
      pairs.forEach((pair, index) => {
        const bits = pair.split(',');
        if (bits.length !== 2 || !bits[0] || !bits[1]) throw new Error(pair);
        const carry = num(bits[0], pair);
        const total = num(bits[1], pair);
        if (carry == null || total == null) throw new Error(pair);
        const shot = addShot(club, index + 1, pair);
        measure({
          shotId: shot.id,
          clubId: club.id,
          sessionId: shot.sessionId,
          metric: 'carry',
          valueNum: carry,
          unit: 'yards',
          quality: 'measured',
          aggregation: 'shot',
        });
        measure({
          shotId: shot.id,
          clubId: club.id,
          sessionId: shot.sessionId,
          metric: 'total',
          valueNum: total,
          unit: 'yards',
          quality: 'measured',
          aggregation: 'shot',
        });
      });
      continue;
    }

    if (section === 'round') {
      if (line.startsWith('Gross ')) {
        const match = /^Gross (\d+), \+(\d+), displayed net (\d+) \(imported, unverified\), F(\d+) B(\d+)$/.exec(line);
        if (!match?.[1] || !match[2] || !match[3] || !match[4] || !match[5]) throw new Error(line);
        roundTotals = {
          gross: Number(match[1]),
          plus: Number(match[2]),
          net: Number(match[3]),
          front: Number(match[4]),
          back: Number(match[5]),
        };
        flag('DISPLAYED_NET_UNVERIFIED', `Displayed net ${match[3]} is imported and unverified. It is not a computed score and not a GHIN result.`);
        continue;
      }
      if (line.startsWith('Holes ')) {
        const match = /^Holes 1-18: ([0-9,]+)$/.exec(line);
        if (!match?.[1]) throw new Error(line);
        holeStrokes = match[1].split(',').map((value) => Number(value));
        if (holeStrokes.length !== 18 || holeStrokes.some((value) => !Number.isInteger(value))) throw new Error(line);
        continue;
      }
      throw new Error(`Unparsed round line: ${line}`);
    }

    if (section === 'uses') {
      if (line.startsWith('Counts:')) {
        if (line !== 'Counts: 5i3 6i1 7i1 8i1 48:2 54:3 56:5 D1 =17') throw new Error(line);
        continue;
      }
      const map: Record<string, string> = {
        Miura56: 'miura56',
        '5i': '5i',
        '6i': '6i',
        '7i': '7i',
        '8i': '8i',
        Miura48: 'miura48',
        Callaway54: 'w54',
        'XR driver': 'driver',
      };
      for (const part of line.split('|')) {
        const bits = part.split(',');
        if (bits.length < 4) throw new Error(part);
        const hole = bits[0];
        const dist = bits[1];
        const clubToken = bits[2];
        const mode = bits.slice(3).join(',');
        if (!hole || !dist || !clubToken || !mode) throw new Error(part);
        const key = map[clubToken];
        if (!key) throw new Error(`Unknown club use token ${clubToken}`);
        uses.push({ hole: Number(hole), dist: Number(dist), key, mode, raw: part });
      }
      continue;
    }

    if (section === 'bias' || section === 'gps' || section === 'gps_est' || section === 'subjective' || section === 'historical' || section === 'bag_done' || section === 'driver_avg_done' || section === 'miura48_done') {
      throw new Error(`Unexpected line in ${section}: ${line}`);
    }
    throw new Error(`Unhandled line in ${section}: ${line}`);
  }

  if (!handed) throw new Error('Handedness missing');
  if (!roundHeader || !roundTotals || !holeStrokes) throw new Error('Round incomplete');
  if (!calibration) throw new Error('Calibration missing');
  if (!session) throw new Error('Session missing');
  if (uses.length !== 17) throw new Error(`Expected 17 club uses, parsed ${uses.length}`);

  const useCounts: Record<string, number> = {};
  for (const use of uses) useCounts[use.key] = (useCounts[use.key] ?? 0) + 1;
  const expectedCounts: Record<string, number> = { '5i': 3, '6i': 1, '7i': 1, '8i': 1, miura48: 2, w54: 3, miura56: 5, driver: 1 };
  for (const [key, count] of Object.entries(expectedCounts)) {
    if (useCounts[key] !== count) throw new Error(`Club use checksum failed for ${key}`);
  }

  const ownedCount = clubs.filter((club) => !club.historicalOnly && club.ownership !== 'not_owned').length;
  if (ownedCount > 14) {
    flag(
      'IN_PLAY_BAG_UNRESOLVED',
      `${ownedCount} clubs are owned or unverified, above the 14-club in-play limit. The in-play bag is empty until the founder chooses.`,
    );
  }

  const roundId = next();
  const round: Round = {
    ...stamp(),
    id: roundId,
    userId,
    courseName: roundHeader.courseName,
    location: roundHeader.location,
    playedOn: roundHeader.playedOn,
    teeName: roundHeader.teeName,
    yardage: roundHeader.yardage,
    par: roundHeader.par,
    courseRating: null,
    slope: null,
    ratingQuality: 'unknown',
    statedGross: roundTotals.gross,
    statedFront: roundTotals.front,
    statedBack: roundTotals.back,
    statedPlus: roundTotals.plus,
    displayedNet: roundTotals.net,
    displayedNetQuality: 'provisional',
    sourceId,
  };
  const ratingCandidates: RatingCandidate[] = roundHeader.ratings.map((rating) => ({
    ...stamp(),
    id: next(),
    userId,
    roundId,
    courseRating: rating.courseRating,
    slope: rating.slope,
    quality: 'provisional',
    selected: false,
  }));
  const holeScores: HoleScore[] = holeStrokes.map((strokes, index) => ({
    ...stamp(),
    id: next(),
    userId,
    roundId,
    holeNumber: index + 1,
    par: null,
    strokes,
    putts: null,
    penalties: null,
  }));

  const gpsObservations: GpsObservation[] = gps.map((row) => ({
    ...stamp(),
    ...row,
    id: next(),
    userId,
    roundId,
  }));
  const clubUses: ClubUseObservation[] = uses.map((use) => ({
    ...stamp(),
    id: next(),
    userId,
    roundId,
    holeNumber: use.hole,
    distanceYards: use.dist,
    clubId: live(use.key).id,
    swingModeText: use.mode,
    outcome: null,
    calibrationEligible: false,
    quality: 'user_confirmed',
    sourceId,
    rawText: use.raw,
  }));

  const ownedBag: Bag = { ...stamp(), id: next(), userId, name: 'Owned', kind: 'owned' };
  const inPlay: Bag = { ...stamp(), id: next(), userId, name: 'In play', kind: 'in_play' };
  const testing: Bag = { ...stamp(), id: next(), userId, name: 'Testing', kind: 'testing' };
  const historical: Bag = { ...stamp(), id: next(), userId, name: 'Historical ideal (history only)', kind: 'historical' };
  const memberships: BagMembership[] = [];
  for (const club of clubs) {
    if (club.historicalOnly) {
      memberships.push({ ...stamp(), id: next(), userId, bagId: historical.id, clubId: club.id });
    } else if (club.ownership !== 'not_owned') {
      memberships.push({ ...stamp(), id: next(), userId, bagId: ownedBag.id, clubId: club.id });
    }
  }

  const noDataKeys = ['w54', 'w58', '3i', '2h', '3h', '4h', '4w'];
  for (const key of noDataKeys) {
    const club = live(key);
    const shotRows = shots.filter((shot) => shot.clubId === club.id);
    if (shotRows.length > 0) throw new Error(`${key} was marked no-data but has shots`);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    user: {
      ...stamp(),
      id: userId,
      displayName: 'Mike Coers',
      audience: 'private',
      nameSource: 'Named in the COOPR 2.0 import brief. The verbatim transcript does not contain the name.',
    },
    player: {
      ...stamp(),
      id: next(),
      userId,
      dominantHand: handed.hand,
      dominantHandQuality: 'user_confirmed',
      dominantHandConfirmedOn: handed.on,
      handicapValue: null,
      handicapOfficial: false,
      handicapQuality: 'unknown',
    },
    caddie: {
      ...stamp(),
      id: next(),
      userId,
      name: '',
      personality: 'funny_knowledgeable',
    },
    sources: [source],
    rawRecords: [
      {
        ...stamp(),
        id: next(),
        userId,
        sourceId,
        label: 'founder-raw-data.md',
        body: raw,
      },
    ],
    clubs,
    bags: [ownedBag, inPlay, testing, historical],
    memberships,
    sessions: [session],
    shots,
    measurements,
    round,
    ratingCandidates,
    holeScores,
    gpsObservations,
    clubUses,
    calibration,
    clubNotes: notes,
    audit: [
      {
        id: next(),
        userId,
        action: 'import_founder',
        entityType: 'user',
        entityId: userId,
        payloadJson: JSON.stringify({ discrepancies: discrepancies.map((item) => item.code), schemaVersion: SCHEMA_VERSION }),
        createdAtMs: options.importedAtMs,
      },
    ],
    discrepancies,
  };
}
