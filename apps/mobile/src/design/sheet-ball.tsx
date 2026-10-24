import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Mask, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  SHEET_BALL,
  SHEET_BALL_CREST,
  SHEET_BALL_DOME,
  SHEET_BALL_LIME,
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
 * One olive-to-lime gradient along the bottom of the glass.
 * The bright lime starts at the cap. Nothing above that is a second layer,
 * so there is no dark seam. The glass clips the paint to the rounded corners.
 */
export const SheetBallArt = memo(function SheetBallArt({ id = 'sheetball' }: { id?: string }) {
  const { viewBox } = SHEET_BALL;
  const [sheetH, setSheetH] = useState(176);
  const olive = oliveHeight(sheetH);
  const crown = Math.max(0, olive - SHEET_BALL_DOME) / olive;
  const limeFull = Math.min(1, crown + 16 / olive);
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
              <Stop offset={Math.min(0.2, crown)} stopColor={SHEET_BALL_OLIVE_DEEP} stopOpacity="1" />
              <Stop offset={crown} stopColor={SHEET_BALL_OLIVE} stopOpacity="1" />
              <Stop offset={limeFull} stopColor={SHEET_BALL_LIME} stopOpacity="1" />
              <Stop offset="1" stopColor={SHEET_BALL_LIME} stopOpacity="1" />
            </LinearGradient>
            <RadialGradient id={`${id}-lobe-l`} gradientUnits="userSpaceOnUse" cx="0" cy={olive} r={SHEET_BALL_LOBE_RADIUS}>
              <Stop offset="0" stopColor={SHEET_BALL_CREST} stopOpacity="1" />
              <Stop offset="0.34" stopColor={SHEET_BALL_CREST} stopOpacity="0.75" />
              <Stop offset="0.58" stopColor={SHEET_BALL_CREST} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={`${id}-lobe-r`} gradientUnits="userSpaceOnUse" cx={viewBox.w} cy={olive} r={SHEET_BALL_LOBE_RADIUS}>
              <Stop offset="0" stopColor={SHEET_BALL_CREST} stopOpacity="1" />
              <Stop offset="0.34" stopColor={SHEET_BALL_CREST} stopOpacity="0.75" />
              <Stop offset="0.58" stopColor={SHEET_BALL_CREST} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={viewBox.w} height={olive} fill={`url(#${id}-olive)`} />
          <Rect x="0" y={olive - SHEET_BALL_DOME} width={viewBox.w} height={SHEET_BALL_DOME} fill={`url(#${id}-lobe-l)`} />
          <Rect x="0" y={olive - SHEET_BALL_DOME} width={viewBox.w} height={SHEET_BALL_DOME} fill={`url(#${id}-lobe-r)`} />
        </Svg>
      </View>
    </View>
  );
});

/** Cap, rim, and dimples. Anything above the crown fades to 15% so it cannot sit under type. */
function SheetCap({ id }: { id: string }) {
  const { viewBox, ball } = SHEET_BALL;
  const dimples = projectedDimples();
  const crown = (viewBox.h - SHEET_BALL_DOME) / viewBox.h;
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
          <Mask id={`${id}-capmask`}>
            <Rect x="0" y="0" width={viewBox.w} height={viewBox.h} fill={`url(#${id}-undertext)`} />
          </Mask>
          <RadialGradient id={`${id}-spec`} cx="50%" cy="42%" r="50%">
            <Stop offset="0" stopColor={SHEET_BALL_RIM} stopOpacity="0.45" />
            <Stop offset="0.55" stopColor={SHEET_BALL_CREST} stopOpacity="0.12" />
            <Stop offset="1" stopColor={SHEET_BALL_RIM} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <G mask={`url(#${id}-capmask)`}>
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
        <Mask id="sheetball-sweepclip">
          <Rect x="0" y="0" width={viewBox.w} height={viewBox.h} fill="url(#sheetball-sweepmask)" />
        </Mask>
        <RadialGradient id="sheetball-sweep" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={SHEET_BALL_RIM} stopOpacity="0.35" />
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
