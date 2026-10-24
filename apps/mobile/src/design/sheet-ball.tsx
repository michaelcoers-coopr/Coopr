import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  SHEET_BALL,
  SHEET_BALL_CREST,
  SHEET_BALL_FEATHER,
  SHEET_BALL_GLOW_BLEND,
  SHEET_BALL_GLOW_ELLIPSE,
  SHEET_BALL_LIME,
  SHEET_BALL_LINE,
  SHEET_BALL_OLIVE,
  SHEET_BALL_SCRIM,
  SHEET_BALL_SCRIM_ALPHA,
  SHEET_BALL_SCRIM_HEIGHT,
  SHEET_BALL_SCRIM_TOP,
  SHEET_BALL_SPECULAR,
  SHEET_BALL_STAGE,
  SHEET_BALL_STROKE,
  projectedDimples,
} from './sheet-ball-geometry';

const stageStyle = {
  position: 'absolute' as const,
  left: 0,
  right: 0,
  bottom: 0,
  height: SHEET_BALL_STAGE,
  zIndex: 0,
};

/**
 * Lime hill and the line-art ball along the bottom of the glass sheet.
 * The glow is screen-blended so the feather stays lime. The ball is strokes only.
 * A short scrim sits where the lowest type crosses the feather. It does not cover the hill.
 */
export const SheetBallArt = memo(function SheetBallArt({ id = 'sheetball' }: { id?: string }) {
  const { viewBox, ball } = SHEET_BALL;
  const glow = SHEET_BALL_GLOW_ELLIPSE;
  const dimples = projectedDimples();
  return (
    <View pointerEvents="none" style={stageStyle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glowBlend]}>
        <Svg pointerEvents="none" width="100%" height="100%" viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} preserveAspectRatio="none">
          <Defs>
            <RadialGradient
              id={`${id}-dome`}
              gradientUnits="userSpaceOnUse"
              cx={glow.cx}
              cy={glow.cy}
              rx={glow.rx}
              ry={glow.ry}
              fx={glow.cx}
              fy={glow.cy + 14}
            >
              <Stop offset="0" stopColor={SHEET_BALL_CREST} stopOpacity="1" />
              <Stop offset="0.34" stopColor={SHEET_BALL_CREST} stopOpacity="1" />
              <Stop offset="0.48" stopColor={SHEET_BALL_LIME} stopOpacity="1" />
              <Stop offset="0.64" stopColor={SHEET_BALL_LIME} stopOpacity="0.82" />
              <Stop offset="0.78" stopColor={SHEET_BALL_OLIVE} stopOpacity="0.48" />
              <Stop offset="0.9" stopColor={SHEET_BALL_OLIVE} stopOpacity="0.1" />
              <Stop offset="1" stopColor={SHEET_BALL_OLIVE} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={`${id}-lobe`} cx="50%" cy="68%" r="52%">
              <Stop offset="0" stopColor={SHEET_BALL_LIME} stopOpacity="0.42" />
              <Stop offset="0.55" stopColor={SHEET_BALL_OLIVE} stopOpacity="0.2" />
              <Stop offset="1" stopColor={SHEET_BALL_OLIVE} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx={glow.cx - 108} cy={viewBox.h - 2} rx="108" ry="76" fill={`url(#${id}-lobe)`} />
          <Ellipse cx={glow.cx + 108} cy={viewBox.h - 2} rx="108" ry="76" fill={`url(#${id}-lobe)`} />
          <Rect x="0" y="0" width={viewBox.w} height={viewBox.h} fill={`url(#${id}-dome)`} />
        </Svg>
      </View>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} preserveAspectRatio="xMidYMax meet">
        <Defs>
          <ClipPath id={`${id}-cap`}>
            <Circle cx={ball.cx} cy={ball.cy} r={ball.r} />
          </ClipPath>
          <RadialGradient id={`${id}-spec`} cx="50%" cy="42%" r="50%">
            <Stop offset="0" stopColor={SHEET_BALL_LINE} stopOpacity="0.85" />
            <Stop offset="0.4" stopColor={SHEET_BALL_CREST} stopOpacity="0.2" />
            <Stop offset="1" stopColor={SHEET_BALL_LINE} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <G clipPath={`url(#${id}-cap)`}>
          {dimples.map((dimple) => (
            <Ellipse
              key={`${dimple.cx.toFixed(2)}-${dimple.cy.toFixed(2)}`}
              cx={dimple.cx}
              cy={dimple.cy}
              rx={dimple.rx}
              ry={dimple.ry}
              fill="none"
              stroke={SHEET_BALL_LINE}
              strokeOpacity={dimple.opacity}
              strokeWidth={SHEET_BALL_STROKE}
            />
          ))}
          <Ellipse
            cx={SHEET_BALL_SPECULAR.cx}
            cy={SHEET_BALL_SPECULAR.cy}
            rx={SHEET_BALL_SPECULAR.rx}
            ry={SHEET_BALL_SPECULAR.ry}
            fill={`url(#${id}-spec)`}
          />
        </G>
      </Svg>
    </View>
  );
});

/** Short dark band where the lowest type crosses the feather. The hill below it stays clear. */
function BallScrim() {
  const { viewBox } = SHEET_BALL;
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="sheetball-scrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={SHEET_BALL_SCRIM} stopOpacity="0" />
          <Stop offset="0.38" stopColor={SHEET_BALL_SCRIM} stopOpacity={SHEET_BALL_SCRIM_ALPHA} />
          <Stop offset="0.62" stopColor={SHEET_BALL_SCRIM} stopOpacity={SHEET_BALL_SCRIM_ALPHA} />
          <Stop offset="1" stopColor={SHEET_BALL_SCRIM} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y={viewBox.h - SHEET_BALL_SCRIM_TOP} width={viewBox.w} height={SHEET_BALL_SCRIM_HEIGHT} fill="url(#sheetball-scrim)" />
    </Svg>
  );
}

/**
 * Specular sweep across the cap.
 * It stays on the hill, under the scrim, and holds still when reduce-motion is on.
 */
function BallShimmer({ reduceMotion }: { reduceMotion: boolean }) {
  const [t, setT] = useState(0.35);
  useEffect(() => {
    if (reduceMotion) return;
    let frame = 0;
    const started = Date.now();
    const loop = () => {
      const cycle = ((Date.now() - started) % 11000) / 11000;
      setT(0.5 - 0.5 * Math.cos(cycle * Math.PI * 2));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion]);
  const { viewBox, ball } = SHEET_BALL;
  const phase = reduceMotion ? 0.35 : t;
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
      preserveAspectRatio="xMidYMax meet"
    >
      <Defs>
        <ClipPath id="sheetball-sweepcap">
          <Circle cx={ball.cx} cy={ball.cy} r={ball.r} />
        </ClipPath>
        <RadialGradient id="sheetball-sweep" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={SHEET_BALL_LINE} stopOpacity="0.7" />
          <Stop offset="1" stopColor={SHEET_BALL_LINE} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <G clipPath="url(#sheetball-sweepcap)">
        <Ellipse cx={70 + phase * 200} cy={SHEET_BALL_FEATHER + 40} rx={42} ry={12} fill="url(#sheetball-sweep)" />
      </G>
    </Svg>
  );
}

/** Decorative glow and ball along the bottom of the glass sheet. Out of the layout flow, behind the type. */
export function SheetBall({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <View pointerEvents="none" style={styles.hold} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SheetBallArt />
      <BallShimmer reduceMotion={reduceMotion} />
      <BallScrim />
    </View>
  );
}

const styles = StyleSheet.create({
  hold: stageStyle,
  glowBlend: { mixBlendMode: SHEET_BALL_GLOW_BLEND },
});
