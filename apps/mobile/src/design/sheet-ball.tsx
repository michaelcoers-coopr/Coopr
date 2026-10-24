import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Mask, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  SHEET_BALL,
  SHEET_BALL_BODY,
  SHEET_BALL_BODY_EDGE,
  SHEET_BALL_BODY_LIT,
  SHEET_BALL_CLEAR_Y,
  SHEET_BALL_GLOW_ELLIPSE,
  SHEET_BALL_GLOW_PEAK,
  SHEET_BALL_LIME,
  SHEET_BALL_LIME_ON_TYPE,
  SHEET_BALL_STAGE,
  dimpleMarks,
  hexDimpleSeeds,
  sheetBallMarks,
} from './sheet-ball-geometry';

const stageStyle = {
  position: 'absolute' as const,
  left: 0,
  right: 0,
  bottom: 0,
  height: SHEET_BALL_STAGE,
  zIndex: 0,
};

function Dimple({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <G>
      {dimpleMarks(cx, cy, r).map((mark) => (
        <Circle
          key={`${mark.cx}-${mark.cy}-${mark.r}-${mark.fill}`}
          cx={mark.cx}
          cy={mark.cy}
          r={mark.r}
          fill={mark.fill}
          fillOpacity={mark.fillOpacity}
        />
      ))}
    </G>
  );
}

/** Static ball. The sweep is a sibling, so a frame does not redraw the dimples. The sweep animates unless reduce-motion is on. */
export const SheetBallArt = memo(function SheetBallArt({ id = 'sheetball' }: { id?: string }) {
  const { viewBox, ball, spacing, dimple } = SHEET_BALL;
  const tileH = spacing * Math.sqrt(3);
  const seeds = hexDimpleSeeds(spacing);
  const rims = sheetBallMarks().filter((mark) => mark.stroke === SHEET_BALL_LIME);
  return (
    <View pointerEvents="none" style={stageStyle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg pointerEvents="none" width="100%" height="100%" viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} preserveAspectRatio="none">
        <Defs>
          <RadialGradient
            id={`${id}-glow`}
            cx={ball.cx}
            cy={viewBox.h + 8}
            rx={SHEET_BALL_GLOW_ELLIPSE.rx}
            ry={SHEET_BALL_GLOW_ELLIPSE.ry}
            fx={ball.cx}
            fy={viewBox.h + 8}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={SHEET_BALL_LIME} stopOpacity={SHEET_BALL_GLOW_PEAK} />
            <Stop offset="0.5" stopColor={SHEET_BALL_LIME} stopOpacity="0.72" />
            <Stop offset="0.78" stopColor={SHEET_BALL_LIME} stopOpacity="0.22" />
            <Stop offset="1" stopColor={SHEET_BALL_LIME} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`${id}-shade`} cx="50%" cy="0%" r="70%">
            <Stop offset="0" stopColor={SHEET_BALL_BODY_LIT} />
            <Stop offset="0.7" stopColor={SHEET_BALL_BODY} />
            <Stop offset="1" stopColor={SHEET_BALL_BODY_EDGE} />
          </RadialGradient>
          <RadialGradient id={`${id}-lift`} cx="50%" cy="100%" r="48%">
            <Stop offset="0" stopColor={SHEET_BALL_LIME} stopOpacity={SHEET_BALL_LIME_ON_TYPE} />
            <Stop offset="1" stopColor={SHEET_BALL_LIME} stopOpacity="0" />
          </RadialGradient>
          <Pattern id={`${id}-dimples`} width={spacing} height={tileH} patternUnits="userSpaceOnUse">
            {seeds.map((seed) => (
              <Dimple key={`${seed.x}-${seed.y}`} cx={seed.x} cy={seed.y} r={dimple} />
            ))}
          </Pattern>
        </Defs>
        <Ellipse
          cx={SHEET_BALL_GLOW_ELLIPSE.cx}
          cy={SHEET_BALL_GLOW_ELLIPSE.cy}
          rx={SHEET_BALL_GLOW_ELLIPSE.rx}
          ry={SHEET_BALL_GLOW_ELLIPSE.ry}
          fill={`url(#${id}-glow)`}
        />
        <Circle cx={ball.cx} cy={ball.cy} r={ball.r} fill={`url(#${id}-shade)`} />
        <Circle cx={ball.cx} cy={ball.cy} r={ball.r} fill={`url(#${id}-lift)`} />
        <Circle cx={ball.cx} cy={ball.cy} r={ball.r} fill={`url(#${id}-dimples)`} />
        {rims.map((rim) => (
          <Circle
            key={`${rim.r}`}
            cx={rim.cx}
            cy={rim.cy}
            r={rim.r}
            fill="none"
            stroke={rim.stroke}
            strokeOpacity={rim.strokeOpacity}
            strokeWidth={rim.strokeWidth}
          />
        ))}
      </Svg>
    </View>
  );
});

/**
 * Specular sweep across the cap.
 * It animates on a slow loop unless reduce-motion is on.
 * Reduce-motion holds one phase and does not schedule frames.
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
  const rim = viewBox.h - 14;
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
      preserveAspectRatio="none"
    >
      <Defs>
        <ClipPath id="sheetball-cap">
          <Circle cx={ball.cx} cy={ball.cy} r={ball.r} />
        </ClipPath>
        <LinearGradient id="sheetball-shimmerfade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <Stop offset={SHEET_BALL_CLEAR_Y / viewBox.h} stopColor="#FFFFFF" stopOpacity="0" />
          <Stop offset={Math.min(1, (SHEET_BALL_CLEAR_Y + 8) / viewBox.h)} stopColor="#FFFFFF" stopOpacity="1" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="1" />
        </LinearGradient>
        <Mask id="sheetball-shimmermask" maskUnits="userSpaceOnUse" x="0" y="0" width={viewBox.w} height={viewBox.h}>
          <Rect width={viewBox.w} height={viewBox.h} fill="url(#sheetball-shimmerfade)" />
        </Mask>
        <RadialGradient id="sheetball-sweep" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={SHEET_BALL_LIME} stopOpacity={SHEET_BALL_LIME_ON_TYPE} />
          <Stop offset="1" stopColor={SHEET_BALL_LIME} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <G clipPath="url(#sheetball-cap)" mask="url(#sheetball-shimmermask)">
        <Ellipse cx={80 + phase * 180} cy={rim} rx={96} ry={14} fill="url(#sheetball-sweep)" />
      </G>
    </Svg>
  );
}

/** Decorative ball along the bottom of the glass sheet. It is out of the layout flow. */
export function SheetBall({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <View pointerEvents="none" style={styles.hold} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SheetBallArt />
      <BallShimmer reduceMotion={reduceMotion} />
    </View>
  );
}

const styles = StyleSheet.create({
  hold: stageStyle,
});
