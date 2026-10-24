import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Mask, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  SHEET_BALL,
  SHEET_BALL_CREST,
  SHEET_BALL_FEATHER,
  SHEET_BALL_GLOW_BLEND,
  SHEET_BALL_GLOW_ELLIPSE,
  SHEET_BALL_LIME,
  SHEET_BALL_LINE,
  SHEET_BALL_LINE_OPACITY,
  SHEET_BALL_SCRIM,
  SHEET_BALL_SCRIM_ALPHA,
  SHEET_BALL_SPECULAR,
  SHEET_BALL_STAGE,
  SHEET_BALL_STROKE,
  hexDimpleSeeds,
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
  const { viewBox, ball, spacing, dimple } = SHEET_BALL;
  const tileH = spacing * Math.sqrt(3);
  const seeds = hexDimpleSeeds(spacing);
  const crestY = SHEET_BALL_FEATHER;
  return (
    <View pointerEvents="none" style={stageStyle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glowBlend]}>
        <Svg pointerEvents="none" width="100%" height="100%" viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={`${id}-feather`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={SHEET_BALL_LIME} stopOpacity="0" />
              <Stop offset="0.45" stopColor={SHEET_BALL_LIME} stopOpacity="0.28" />
              <Stop offset="1" stopColor={SHEET_BALL_LIME} stopOpacity="0.7" />
            </LinearGradient>
            <LinearGradient id={`${id}-sides`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="0.12" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="0.88" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
            <Mask id={`${id}-sidemask`} maskUnits="userSpaceOnUse" x="0" y="0" width={viewBox.w} height={viewBox.h}>
              <Rect width={viewBox.w} height={viewBox.h} fill={`url(#${id}-sides)`} />
            </Mask>
            <ClipPath id={`${id}-featherclip`}>
              <Rect x="0" y="0" width={viewBox.w} height={crestY} />
            </ClipPath>
          </Defs>
          <G mask={`url(#${id}-sidemask)`}>
            <Ellipse
              cx={SHEET_BALL_GLOW_ELLIPSE.cx}
              cy={SHEET_BALL_GLOW_ELLIPSE.cy}
              rx={SHEET_BALL_GLOW_ELLIPSE.rx}
              ry={SHEET_BALL_GLOW_ELLIPSE.ry}
              fill={SHEET_BALL_LIME}
            />
            <G clipPath={`url(#${id}-featherclip)`}>
              <Ellipse cx={ball.cx} cy={crestY} rx="220" ry={SHEET_BALL_FEATHER} fill={`url(#${id}-feather)`} />
            </G>
          </G>
        </Svg>
      </View>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={`${id}-hot`} cx="50%" cy="45%" r="55%">
            <Stop offset="0" stopColor={SHEET_BALL_CREST} stopOpacity="1" />
            <Stop offset="0.55" stopColor={SHEET_BALL_CREST} stopOpacity="0.55" />
            <Stop offset="1" stopColor={SHEET_BALL_CREST} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={ball.cx} cy={crestY + 32} rx="100" ry="20" fill={`url(#${id}-hot)`} />
      </Svg>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} preserveAspectRatio="xMidYMax meet">
        <Defs>
          <ClipPath id={`${id}-cap`}>
            <Circle cx={ball.cx} cy={ball.cy} r={ball.r} />
          </ClipPath>
          <Pattern id={`${id}-dimples`} width={spacing} height={tileH} patternUnits="userSpaceOnUse">
            {seeds.map((seed) => (
              <Circle
                key={`${seed.x}-${seed.y}`}
                cx={seed.x}
                cy={seed.y}
                r={dimple}
                fill="none"
                stroke={SHEET_BALL_LINE}
                strokeOpacity={SHEET_BALL_LINE_OPACITY}
                strokeWidth={SHEET_BALL_STROKE}
              />
            ))}
          </Pattern>
          <RadialGradient id={`${id}-spec`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={SHEET_BALL_LINE} stopOpacity="0.9" />
            <Stop offset="0.35" stopColor={SHEET_BALL_CREST} stopOpacity="0.35" />
            <Stop offset="1" stopColor={SHEET_BALL_LINE} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <G clipPath={`url(#${id}-cap)`}>
          <Rect x="0" y="0" width={viewBox.w} height={viewBox.h} fill={`url(#${id}-dimples)`} />
          <Ellipse
            cx={SHEET_BALL_SPECULAR.cx}
            cy={SHEET_BALL_SPECULAR.cy}
            rx={SHEET_BALL_SPECULAR.rx}
            ry={SHEET_BALL_SPECULAR.ry}
            fill={`url(#${id}-spec)`}
          />
        </G>
        <Circle
          cx={ball.cx}
          cy={ball.cy}
          r={ball.r - SHEET_BALL_STROKE / 2}
          fill="none"
          stroke={SHEET_BALL_LINE}
          strokeOpacity={0.55}
          strokeWidth={SHEET_BALL_STROKE}
        />
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
          <Stop offset="0.18" stopColor={SHEET_BALL_SCRIM} stopOpacity={SHEET_BALL_SCRIM_ALPHA} />
          <Stop offset="0.78" stopColor={SHEET_BALL_SCRIM} stopOpacity={SHEET_BALL_SCRIM_ALPHA} />
          <Stop offset="1" stopColor={SHEET_BALL_SCRIM} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="6" width={viewBox.w} height="46" fill="url(#sheetball-scrim)" />
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
