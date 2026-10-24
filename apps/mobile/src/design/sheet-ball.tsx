import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  SHEET_BALL,
  SHEET_BALL_CREST,
  SHEET_BALL_LIME,
  SHEET_BALL_LIME_BAND,
  SHEET_BALL_LINE,
  SHEET_BALL_LOBE_RADIUS,
  SHEET_BALL_OLIVE,
  SHEET_BALL_OLIVE_DEEP,
  SHEET_BALL_RIM,
  SHEET_BALL_RIM_OPACITY,
  SHEET_BALL_SCRIM,
  SHEET_BALL_SCRIM_ALPHA,
  SHEET_BALL_SCRIM_TOP,
  SHEET_BALL_SPECULAR,
  SHEET_BALL_STROKE,
  oliveHeight,
  projectedDimples,
} from './sheet-ball-geometry';

const stageStyle = {
  position: 'absolute' as const,
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  zIndex: 0,
};

/**
 * Full-width lime along the bottom of the glass, olive climbing above it,
 * and a line-art cap. The glass clips the paint to the rounded corners.
 */
export const SheetBallArt = memo(function SheetBallArt({ id = 'sheetball' }: { id?: string }) {
  const { viewBox, ball } = SHEET_BALL;
  const dimples = projectedDimples();
  const [sheetH, setSheetH] = useState(176);
  const olive = oliveHeight(sheetH);
  return (
    <View
      pointerEvents="none"
      style={stageStyle}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.height);
        if (next > 0 && next !== sheetH) setSheetH(next);
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View pointerEvents="none" style={[styles.olive, { height: olive }]}>
        <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={`${id}-olive`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={SHEET_BALL_OLIVE_DEEP} stopOpacity="0" />
              <Stop offset="0.12" stopColor={SHEET_BALL_OLIVE_DEEP} stopOpacity="1" />
              <Stop offset="0.5" stopColor={SHEET_BALL_OLIVE} stopOpacity="1" />
              <Stop offset="1" stopColor={SHEET_BALL_OLIVE} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill={`url(#${id}-olive)`} />
        </Svg>
      </View>
      <View pointerEvents="none" style={styles.lime}>
        <Svg pointerEvents="none" width="100%" height="100%" viewBox={`0 0 ${viewBox.w} ${SHEET_BALL_LIME_BAND}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={`${id}-lime`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={SHEET_BALL_LIME} stopOpacity="0" />
              <Stop offset="0.14" stopColor={SHEET_BALL_LIME} stopOpacity="1" />
              <Stop offset="1" stopColor={SHEET_BALL_LIME} stopOpacity="1" />
            </LinearGradient>
            <RadialGradient id={`${id}-lobe-l`} gradientUnits="userSpaceOnUse" cx="0" cy={SHEET_BALL_LIME_BAND} r={SHEET_BALL_LOBE_RADIUS}>
              <Stop offset="0" stopColor={SHEET_BALL_CREST} stopOpacity="1" />
              <Stop offset="0.42" stopColor={SHEET_BALL_CREST} stopOpacity="0.9" />
              <Stop offset="0.78" stopColor={SHEET_BALL_CREST} stopOpacity="0.22" />
              <Stop offset="1" stopColor={SHEET_BALL_CREST} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={`${id}-lobe-r`} gradientUnits="userSpaceOnUse" cx={viewBox.w} cy={SHEET_BALL_LIME_BAND} r={SHEET_BALL_LOBE_RADIUS}>
              <Stop offset="0" stopColor={SHEET_BALL_CREST} stopOpacity="1" />
              <Stop offset="0.42" stopColor={SHEET_BALL_CREST} stopOpacity="0.9" />
              <Stop offset="0.78" stopColor={SHEET_BALL_CREST} stopOpacity="0.22" />
              <Stop offset="1" stopColor={SHEET_BALL_CREST} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={viewBox.w} height={SHEET_BALL_LIME_BAND} fill={`url(#${id}-lime)`} />
          <Rect x="0" y="0" width={viewBox.w} height={SHEET_BALL_LIME_BAND} fill={`url(#${id}-lobe-l)`} />
          <Rect x="0" y="0" width={viewBox.w} height={SHEET_BALL_LIME_BAND} fill={`url(#${id}-lobe-r)`} />
        </Svg>
      </View>
      <Svg
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
        preserveAspectRatio="xMidYMax slice"
      >
        <Defs>
          <ClipPath id={`${id}-cap`}>
            <Circle cx={ball.cx} cy={ball.cy} r={ball.r} />
          </ClipPath>
          <RadialGradient id={`${id}-spec`} cx="50%" cy="42%" r="50%">
            <Stop offset="0" stopColor={SHEET_BALL_RIM} stopOpacity="0.8" />
            <Stop offset="0.45" stopColor={SHEET_BALL_CREST} stopOpacity="0.28" />
            <Stop offset="1" stopColor={SHEET_BALL_RIM} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <G clipPath={`url(#${id}-cap)`}>
          {dimples.map((dimple) => (
            <Ellipse
              key={`${dimple.cx.toFixed(1)}-${dimple.cy.toFixed(1)}`}
              cx={dimple.cx}
              cy={dimple.cy}
              rx={dimple.rx}
              ry={dimple.ry}
              fill="none"
              stroke={SHEET_BALL_LINE}
              strokeOpacity={dimple.opacity}
              strokeWidth={SHEET_BALL_STROKE}
              transform={`rotate(${dimple.rotation} ${dimple.cx} ${dimple.cy})`}
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
        <Circle
          cx={ball.cx}
          cy={ball.cy}
          r={ball.r - SHEET_BALL_STROKE / 2}
          fill="none"
          stroke={SHEET_BALL_RIM}
          strokeOpacity={SHEET_BALL_RIM_OPACITY}
          strokeWidth={SHEET_BALL_STROKE}
        />
      </Svg>
    </View>
  );
});

/** Soft dark wash where the lowest type crosses the lime. It fades at both ends. */
function BallScrim() {
  return (
    <View pointerEvents="none" style={styles.scrim}>
      <Svg pointerEvents="none" width="100%" height="100%" viewBox={`0 0 360 ${SHEET_BALL_SCRIM_TOP}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="sheetball-scrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={SHEET_BALL_SCRIM} stopOpacity="0" />
            <Stop offset="0.14" stopColor={SHEET_BALL_SCRIM} stopOpacity={SHEET_BALL_SCRIM_ALPHA} />
            <Stop offset="0.58" stopColor={SHEET_BALL_SCRIM} stopOpacity={SHEET_BALL_SCRIM_ALPHA} />
            <Stop offset="1" stopColor={SHEET_BALL_SCRIM} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="360" height={SHEET_BALL_SCRIM_TOP} fill="url(#sheetball-scrim)" />
      </Svg>
    </View>
  );
}

/**
 * Specular sweep across the cap.
 * It holds still when reduce-motion is on.
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
      preserveAspectRatio="xMidYMax slice"
    >
      <Defs>
        <ClipPath id="sheetball-sweepcap">
          <Circle cx={ball.cx} cy={ball.cy} r={ball.r} />
        </ClipPath>
        <RadialGradient id="sheetball-sweep" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={SHEET_BALL_RIM} stopOpacity="0.55" />
          <Stop offset="1" stopColor={SHEET_BALL_RIM} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <G clipPath="url(#sheetball-sweepcap)">
        <Ellipse cx={40 + phase * 280} cy={SHEET_BALL_SPECULAR.cy} rx={54} ry={16} fill="url(#sheetball-sweep)" />
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
  olive: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  lime: { position: 'absolute', left: 0, right: 0, bottom: 0, height: SHEET_BALL_LIME_BAND },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: SHEET_BALL_SCRIM_TOP },
});
