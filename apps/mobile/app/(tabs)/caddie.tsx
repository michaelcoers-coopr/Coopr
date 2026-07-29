import { useMemo, useState } from 'react';
import { ScrollView, View, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { recommend } from '@coopr/engine';
import type {
  RecommendationInput,
  Recommendation,
  Lie,
  WindDirection,
  StrategicIntent,
  RiskPreference,
  DistanceMetric,
  Hazard,
} from '@coopr/core';
import { useTheme } from '../../src/theme';
import { Card, H1, H2, Body, Label, Button, Segmented, RiskPill, Divider } from '../../src/ui';
import { getFirstUserId } from '../../src/db/repo';
import { computePlayerProfiles } from '../../src/features/profiles';

export default function Caddie() {
  const t = useTheme();
  const userId = getFirstUserId();
  const profiles = useMemo(() => (userId ? computePlayerProfiles(userId, Date.now()) : []), [userId]);

  const [distance, setDistance] = useState('160');
  const [metric, setMetric] = useState<DistanceMetric>('total');
  const [lie, setLie] = useState<Lie>('fairway');
  const [windDir, setWindDir] = useState<WindDirection>('none');
  const [windSpeed, setWindSpeed] = useState('0');
  const [elevation, setElevation] = useState('0');
  const [temp, setTemp] = useState('70');
  const [intent, setIntent] = useState<StrategicIntent>('attack_pin');
  const [risk, setRisk] = useState<RiskPreference>('neutral');
  const [frontHazard, setFrontHazard] = useState(false);
  const [frontHazardDist, setFrontHazardDist] = useState('150');
  const [rightHazard, setRightHazard] = useState(false);
  const [leftHazard, setLeftHazard] = useState(false);

  const [result, setResult] = useState<Recommendation | null>(null);

  const run = () => {
    const hazards: Hazard[] = [];
    if (frontHazard) hazards.push({ side: 'front', kind: 'bunker', distanceYards: num(frontHazardDist) });
    if (rightHazard) hazards.push({ side: 'right', kind: 'water', distanceYards: null });
    if (leftHazard) hazards.push({ side: 'left', kind: 'general', distanceYards: null });

    const input: RecommendationInput = {
      targetDistanceYards: num(distance),
      targetMetric: metric,
      conditions: {
        lie,
        wind: windDir === 'none' ? null : { speedMph: num(windSpeed), direction: windDir },
        elevationDeltaYards: num(elevation),
        temperatureF: num(temp),
      },
      hazards,
      intent,
      riskPreference: risk,
      profiles,
    };
    setResult(recommend(input));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg }} keyboardShouldPersistTaps="handled">
        <Label>Quick Caddie</Label>
        <H1>What's the shot?</H1>

        <Card>
          <Label>Distance to target</Label>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
            <NumInput value={distance} onChange={setDistance} width={90} />
            <Segmented
              options={[
                { value: 'carry', label: 'Carry' },
                { value: 'total', label: 'Total' },
              ]}
              value={metric}
              onChange={setMetric}
            />
          </View>

          <Label>Lie</Label>
          <Segmented
            options={[
              { value: 'tee', label: 'Tee' },
              { value: 'fairway', label: 'Fairway' },
              { value: 'light_rough', label: 'Lt rough' },
              { value: 'heavy_rough', label: 'Hvy rough' },
              { value: 'sand', label: 'Sand' },
            ]}
            value={lie}
            onChange={setLie}
          />

          <Label>Wind</Label>
          <Segmented
            options={[
              { value: 'none', label: 'None' },
              { value: 'head', label: 'Into' },
              { value: 'tail', label: 'Down' },
              { value: 'left_to_right', label: 'L→R' },
              { value: 'right_to_left', label: 'R→L' },
            ]}
            value={windDir}
            onChange={setWindDir}
          />
          {windDir !== 'none' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
              <NumInput value={windSpeed} onChange={setWindSpeed} width={70} />
              <Body muted>mph</Body>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: t.spacing.xl }}>
            <View>
              <Label>Elevation (yd, +up)</Label>
              <NumInput value={elevation} onChange={setElevation} width={90} allowNegative />
            </View>
            <View>
              <Label>Temp (°F)</Label>
              <NumInput value={temp} onChange={setTemp} width={90} />
            </View>
          </View>

          <Label>Trouble</Label>
          <Toggle label="Front hazard" on={frontHazard} onToggle={() => setFrontHazard((v) => !v)} />
          {frontHazard ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
              <Body muted>carry to clear</Body>
              <NumInput value={frontHazardDist} onChange={setFrontHazardDist} width={70} />
            </View>
          ) : null}
          <Toggle label="Water/trouble right" on={rightHazard} onToggle={() => setRightHazard((v) => !v)} />
          <Toggle label="Trouble left" on={leftHazard} onToggle={() => setLeftHazard((v) => !v)} />

          <Label>Intent</Label>
          <Segmented
            options={[
              { value: 'attack_pin', label: 'Attack' },
              { value: 'play_safe', label: 'Safe' },
              { value: 'lay_up', label: 'Lay up' },
            ]}
            value={intent}
            onChange={setIntent}
          />
          <Label>Risk</Label>
          <Segmented
            options={[
              { value: 'conservative', label: 'Conservative' },
              { value: 'neutral', label: 'Neutral' },
              { value: 'aggressive', label: 'Aggressive' },
            ]}
            value={risk}
            onChange={setRisk}
          />
        </Card>

        <Button title="GET RECOMMENDATION" onPress={run} />

        {profiles.length === 0 ? (
          <Card>
            <Body muted>No club data yet. Add shots in Practice to enable recommendations.</Body>
          </Card>
        ) : null}

        {result ? <ResultCard result={result} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultCard({ result }: { result: Recommendation }) {
  const t = useTheme();
  const band = (q: { p20: number; p50: number; p80: number } | null) =>
    q ? `${Math.round(q.p20)}–${Math.round(q.p80)} yd (stock ${Math.round(q.p50)})` : null;
  const carry = band(result.expectedCarryYards);
  const total = band(result.expectedTotalYards);

  return (
    <Card>
      <Label>Recommendation</Label>
      <H1>
        {result.clubLabel} · {result.swingMode}
      </H1>
      <Body>Target: {result.strategicTarget}</Body>
      <Body muted>Aim: {result.recommendedAim}</Body>

      <Divider />
      <Label>Plays like</Label>
      <H2>{Math.round(result.playsLikeDistanceYards)} yd</H2>
      {carry ? <Body muted>Expected carry {carry}</Body> : null}
      {total ? <Body muted>Expected total {total}</Body> : null}

      <Divider />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <RiskPill label="Short" level={result.shortRisk} />
        <RiskPill label="Long" level={result.longRisk} />
        <RiskPill label="Left" level={result.leftRisk} />
        <RiskPill label="Right" level={result.rightRisk} />
      </View>
      {result.missZoneWarning ? (
        <Body style={{ marginTop: t.spacing.sm, color: t.semantic.warning }}>{result.missZoneWarning}</Body>
      ) : null}
      {result.mechanicalMissPattern ? (
        <Body muted style={{ marginTop: t.spacing.sm }}>
          Awareness: {result.mechanicalMissPattern} (this does not change your aim).
        </Body>
      ) : null}

      <Divider />
      <Label>Why</Label>
      {result.reasons.map((r, i) => (
        <Body key={i} muted style={{ marginTop: t.spacing.xs }}>
          • {r.text}
        </Body>
      ))}
      <Body muted style={{ marginTop: t.spacing.sm }}>
        Confidence {Math.round(result.confidence * 100)}%
      </Body>
    </Card>
  );
}

function NumInput({
  value,
  onChange,
  width,
  allowNegative,
}: {
  value: string;
  onChange: (v: string) => void;
  width: number;
  allowNegative?: boolean;
}) {
  const t = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      keyboardType={allowNegative ? 'numbers-and-punctuation' : 'number-pad'}
      style={{
        width,
        color: t.textPrimary,
        backgroundColor: t.surface,
        borderColor: t.border,
        borderWidth: 1,
        borderRadius: t.radius.sm,
        paddingHorizontal: t.spacing.md,
        paddingVertical: t.spacing.sm,
        fontSize: t.fontSize.md,
        marginVertical: t.spacing.xs,
      }}
    />
  );
}

function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: t.spacing.xs }}>
      <Body onPress={onToggle} style={{ color: on ? t.accent : t.textSecondary }}>
        {on ? '☑' : '☐'} {label}
      </Body>
    </View>
  );
}

function num(s: string): number {
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
