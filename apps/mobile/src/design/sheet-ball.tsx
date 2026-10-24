import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Mask, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  SHEET_BALL,
  SHEET_BALL_CREST,
  SHEET_BALL_DOME,
  SHEET_BALL_INTERIOR,
  SHEET_BALL_INTERIOR_ALPHA,
  SHEET_BALL_LIME,
  SHEET_BALL_LIME_BAND,
  SHEET_BALL_LIME_FEATHER,
  SHEET_BALL_LINE,
  SHEET_BALL_LOBE_RADIUS,
  SHEET_BALL_OLIVE,
  SHEET_BALL_OLIVE_DEEP,
  SHEET_BALL_RIM,
  SHEET_BALL_RIM_OPACITY,
  SHEET_BALL_RIM_WIDTH,
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
 * Bright lime across the bottom of the sheet, with a crest in each corner.
 * A short blend keeps the lime below the type. The cap paints on top.
 */
export const SheetBallArt = memo(function SheetBallArt({ id = 'sheetball' }: { id?: string }) {
  const { viewBox } = SHEET_BALL;
  const [sheetH, setSheetH] = useState(176);
  const olive = oliveHeight(sheetH);
  const limeTop = 60;
  const blend = 20;
  const limeStart = (olive - limeTop) / olive;
  const blendStart = (olive - limeTop - blend) / olive;
  const deepIn = Math.min(0.14, blendStart * 0.35);
  const lobeCore = (SHEET_BALL_LIME_BAND - SHEET_BALL_LIME_FEATHER) / SHEET_BALL_LIME_BAND;
  const lobeMid = lobeCore + (1 - lobeCore) * 0.42;
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
        <Svg pointerEvents="none" width="100%" height="100%" viewBox={`0 0 ${viewBox.w} ${olive}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={`${id}-olive`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={SHEET_BALL_OLIVE_DEEP} stopOpacity="0" />
              <Stop offset={deepIn} stopColor={SHEET_BALL_OLIVE_DEEP} stopOpacity="1" />
              <Stop offset={blendStart} stopColor={SHEET_BALL_OLIVE} stopOpacity="1" />
              <Stop offset={limeStart} stopColor={SHEET_BALL_LIME} stopOpacity="1" />
              <Stop offset="1" stopColor={SHEET_BALL_LIME} stopOpacity="1" />
            </LinearGradient>
            <RadialGradient id={`${id}-valley`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={SHEET_BALL_OLIVE} stopOpacity="0.22" />
              <Stop offset="0.6" stopColor={SHEET_BALL_OLIVE} stopOpacity="0.08" />
              <Stop offset="1" stopColor={SHEET_BALL_OLIVE} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={`${id}-lobe-l`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={SHEET_BALL_CREST} stopOpacity="1" />
              <Stop offset={lobeCore} stopColor={SHEET_BALL_CREST} stopOpacity="1" />
              <Stop offset={lobeMid} stopColor={SHEET_BALL_LIME} stopOpacity="0.7" />
              <Stop offset="1" stopColor={SHEET_BALL_LIME} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={`${id}-lobe-r`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={SHEET_BALL_CREST} stopOpacity="1" />
              <Stop offset={lobeCore} stopColor={SHEET_BALL_CREST} stopOpacity="1" />
              <Stop offset={lobeMid} stopColor={SHEET_BALL_LIME} stopOpacity="0.7" />
              <Stop offset="1" stopColor={SHEET_BALL_LIME} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={viewBox.w} height={olive} fill={`url(#${id}-olive)`} />
          <Ellipse cx={viewBox.w / 2} cy={olive} rx={viewBox.w * 0.28} ry={46} fill={`url(#${id}-valley)`} />
          <Ellipse cx={0} cy={olive} rx={SHEET_BALL_LOBE_RADIUS} ry={SHEET_BALL_LIME_BAND} fill={`url(#${id}-lobe-l)`} />
          <Ellipse cx={viewBox.w} cy={olive} rx={SHEET_BALL_LOBE_RADIUS} ry={SHEET_BALL_LIME_BAND} fill={`url(#${id}-lobe-r)`} />
        </Svg>
      </View>
    </View>
  );
});

/** Cap, rim, and dimples. The rim dissolves into the lime, and anything above the crown stays at 15%. */
function SheetCap({ id }: { id: string }) {
  const { viewBox, ball } = SHEET_BALL;
  const dimples = projectedDimples();
  const crown = (viewBox.h - SHEET_BALL_DOME - 2) / viewBox.h;
  const edge = 1 - 18 / ball.r;
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
          <ClipPath id={`${id}-cap`}>
            <Circle cx={ball.cx} cy={ball.cy} r={ball.r} />
          </ClipPath>
          <LinearGradient id={`${id}-undertext`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.15" />
            <Stop offset={crown} stopColor="#FFFFFF" stopOpacity="0.15" />
            <Stop offset={Math.min(1, crown + 0.004)} stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="1" />
          </LinearGradient>
          <RadialGradient id={`${id}-edge`} gradientUnits="userSpaceOnUse" cx={ball.cx} cy={ball.cy} r={ball.r}>
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset={edge} stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="1" stopColor="#000000" stopOpacity="1" />
          </RadialGradient>
          <Mask id={`${id}-capmask`}>
            <Rect x="0" y="0" width={viewBox.w} height={viewBox.h} fill={`url(#${id}-undertext)`} />
            <Circle cx={ball.cx} cy={ball.cy} r={ball.r} fill={`url(#${id}-edge)`} />
          </Mask>
          <RadialGradient id={`${id}-spec`} cx="50%" cy="42%" r="50%">
            <Stop offset="0" stopColor={SHEET_BALL_RIM} stopOpacity="0.92" />
            <Stop offset="0.38" stopColor={SHEET_BALL_CREST} stopOpacity="0.55" />
            <Stop offset="1" stopColor={SHEET_BALL_RIM} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <G mask={`url(#${id}-capmask)`}>
          <G clipPath={`url(#${id}-cap)`}>
            <Circle cx={ball.cx} cy={ball.cy} r={ball.r} fill={SHEET_BALL_INTERIOR} fillOpacity={SHEET_BALL_INTERIOR_ALPHA} />
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
            r={ball.r - SHEET_BALL_RIM_WIDTH / 2}
            fill="none"
            stroke={SHEET_BALL_RIM}
            strokeOpacity={SHEET_BALL_RIM_OPACITY}
            strokeWidth={SHEET_BALL_RIM_WIDTH}
          />
        </G>
      </Svg>
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
  const edge = 1 - 18 / ball.r;
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
        <LinearGradient id="sheetball-sweepmask" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.15" />
          <Stop offset={(viewBox.h - SHEET_BALL_DOME) / viewBox.h} stopColor="#FFFFFF" stopOpacity="0.15" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="1" />
        </LinearGradient>
        <RadialGradient id="sheetball-sweepedge" gradientUnits="userSpaceOnUse" cx={ball.cx} cy={ball.cy} r={ball.r}>
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
          <Stop offset={edge} stopColor="#FFFFFF" stopOpacity="1" />
          <Stop offset="1" stopColor="#000000" stopOpacity="1" />
        </RadialGradient>
        <Mask id="sheetball-sweepclip">
          <Rect x="0" y="0" width={viewBox.w} height={viewBox.h} fill="url(#sheetball-sweepmask)" />
          <Circle cx={ball.cx} cy={ball.cy} r={ball.r} fill="url(#sheetball-sweepedge)" />
        </Mask>
        <RadialGradient id="sheetball-sweep" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={SHEET_BALL_RIM} stopOpacity="0.7" />
          <Stop offset="1" stopColor={SHEET_BALL_RIM} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <G mask="url(#sheetball-sweepclip)" clipPath="url(#sheetball-sweepcap)">
        <Ellipse cx={40 + phase * 220} cy={SHEET_BALL_SPECULAR.cy} rx={40} ry={8} fill="url(#sheetball-sweep)" />
      </G>
    </Svg>
  );
}

/** Decorative glow and ball along the bottom of the glass sheet. Out of the layout flow, behind the type. */
export function SheetBall({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <View pointerEvents="none" style={styles.hold} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SheetBallArt />
      <SheetCap id="sheetball" />
      <BallShimmer reduceMotion={reduceMotion} />
    </View>
  );
}

const styles = StyleSheet.create({
  hold: stageStyle,
  olive: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
