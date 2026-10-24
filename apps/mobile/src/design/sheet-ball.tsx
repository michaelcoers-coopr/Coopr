import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SHEET_BALL, SHEET_BALL_LIME, dimpleMarks, hexDimpleSeeds, sheetBallMarks } from './sheet-ball-geometry';

const stageStyle = {
  position: 'absolute' as const,
  left: 0,
  right: 0,
  bottom: 0,
  height: 132,
  zIndex: 0,
};

function Dimple({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <G>
      {dimpleMarks(cx, cy, r).map((mark) => (
        <Circle key={`${mark.cx}-${mark.cy}`} cx={mark.cx} cy={mark.cy} r={mark.r} fill={mark.fill} fillOpacity={mark.fillOpacity} />
      ))}
    </G>
  );
}

/** Static ball. The moving sheen is a sibling, so a shimmer frame does not redraw the dimples. */
export const SheetBallArt = memo(function SheetBallArt({ id = 'sheetball' }: { id?: string }) {
  const { viewBox, ball, spacing, dimple } = SHEET_BALL;
  const tileH = spacing * Math.sqrt(3);
  const seeds = hexDimpleSeeds(spacing);
  const rims = sheetBallMarks().filter((mark) => mark.stroke === SHEET_BALL_LIME);
  const glow = sheetBallMarks().find((mark) => mark.tag === 'ellipse');
  return (
    <View pointerEvents="none" style={stageStyle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} accessibilityElementsHidden>
        <Defs>
          <RadialGradient id={`${id}-glow`} cx="50%" cy="100%" r="62%">
            <Stop offset="0" stopColor={SHEET_BALL_LIME} stopOpacity="0.55" />
            <Stop offset="0.42" stopColor={SHEET_BALL_LIME} stopOpacity="0.16" />
            <Stop offset="1" stopColor={SHEET_BALL_LIME} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`${id}-shade`} cx="36%" cy="28%" r="72%">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.48" stopColor="#E6E1D6" />
            <Stop offset="1" stopColor="#B7B1A4" />
          </RadialGradient>
          <RadialGradient id={`${id}-limb`} cx="50%" cy="42%" r="58%">
            <Stop offset="0.55" stopColor="#1A140C" stopOpacity="0" />
            <Stop offset="1" stopColor="#1A140C" stopOpacity="0.34" />
          </RadialGradient>
          <LinearGradient id={`${id}-dissolve`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#040A18" stopOpacity="0.94" />
            <Stop offset="0.34" stopColor="#040A18" stopOpacity="0.5" />
            <Stop offset="0.62" stopColor="#040A18" stopOpacity="0" />
          </LinearGradient>
          <Pattern id={`${id}-dimples`} width={spacing} height={tileH} patternUnits="userSpaceOnUse">
            {seeds.map((seed) => (
              <Dimple key={`${seed.x}-${seed.y}`} cx={seed.x} cy={seed.y} r={dimple} />
            ))}
          </Pattern>
        </Defs>
        {glow ? <Ellipse cx={glow.cx} cy={glow.cy} rx={glow.rx} ry={glow.ry} fill={`url(#${id}-glow)`} /> : null}
        <G>
          <Circle cx={ball.cx} cy={ball.cy} r={ball.r} fill={`url(#${id}-shade)`} />
          <Circle cx={ball.cx} cy={ball.cy} r={ball.r} fill={`url(#${id}-dimples)`} />
          <Circle cx={ball.cx} cy={ball.cy} r={ball.r} fill={`url(#${id}-limb)`} />
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
        </G>
        <Rect width={viewBox.w} height={viewBox.h} fill={`url(#${id}-dissolve)`} />
        <Ellipse cx={128} cy={148} rx={62} ry={22} fill="#FFFFFF" fillOpacity={0.2} />
      </Svg>
    </View>
  );
});

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
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}>
      <Defs>
        <ClipPath id="sheetball-cap">
          <Circle cx={ball.cx} cy={ball.cy} r={ball.r} />
        </ClipPath>
        <RadialGradient id="sheetball-sweep" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <G clipPath="url(#sheetball-cap)">
        <Ellipse cx={96 + phase * 120} cy={150} rx={54} ry={18} fill="url(#sheetball-sweep)" />
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
