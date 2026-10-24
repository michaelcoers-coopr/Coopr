import { useState } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SHEET_BALL_CAP_HEIGHT, oliveHeight } from './sheet-ball-geometry';

const ballSource = require('../../assets/images/ball-lime.webp') as ImageSourcePropType;

const stageStyle = {
  position: 'absolute' as const,
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  zIndex: 0,
};

/**
 * Photo ball on a lime halo, with olive climbing the sheet above it.
 * Bottom-anchored. The sheet clip rounds the corners. Nothing here takes touches.
 */
export function SheetBall({ reduceMotion }: { reduceMotion: boolean }) {
  void reduceMotion;
  const [size, setSize] = useState({ w: 366, h: 176 });
  const { w, h } = size;
  const olive = oliveHeight(h);
  return (
    <View
      pointerEvents="none"
      style={stageStyle}
      onLayout={(event) => {
        const nextW = Math.round(event.nativeEvent.layout.width);
        const nextH = Math.round(event.nativeEvent.layout.height);
        if (nextW > 0 && nextH > 0 && (nextW !== w || nextH !== h)) setSize({ w: nextW, h: nextH });
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="sheetball-olive" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0A0E04" stopOpacity="0" />
            <Stop offset="0.28" stopColor="#243008" stopOpacity="0.50" />
            <Stop offset="0.40" stopColor="#6A8A22" stopOpacity="0.46" />
            <Stop offset="0.50" stopColor="#3C4E0C" stopOpacity="0.34" />
            <Stop offset="0.66" stopColor="#A4CC3A" stopOpacity="0.22" />
            <Stop offset="0.82" stopColor="#6A8A22" stopOpacity="0.12" />
            <Stop offset="1" stopColor="#A4CC3A" stopOpacity="0.08" />
          </LinearGradient>
          <RadialGradient id="sheetball-halo" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#BEF546" stopOpacity="1" />
            <Stop offset="0.55" stopColor="#A8E030" stopOpacity="0.92" />
            <Stop offset="0.78" stopColor="#8AC926" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#8AC926" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="sheetball-spill-l" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#A0E132" stopOpacity="0.88" />
            <Stop offset="1" stopColor="#A0E132" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="sheetball-spill-r" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#A0E132" stopOpacity="0.88" />
            <Stop offset="1" stopColor="#A0E132" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y={h - olive} width={w} height={olive} fill="url(#sheetball-olive)" />
        <Ellipse cx={w / 2} cy={h + 16} rx={w * 0.66} ry={118} fill="url(#sheetball-halo)" />
        <Ellipse cx={0} cy={h} rx={96} ry={92} fill="url(#sheetball-spill-l)" />
        <Ellipse cx={w} cy={h} rx={96} ry={92} fill="url(#sheetball-spill-r)" />
      </Svg>
      <Image
        source={ballSource}
        resizeMode="stretch"
        fadeDuration={0}
        accessibilityIgnoresInvertColors
        style={[styles.cap, { width: w, height: SHEET_BALL_CAP_HEIGHT }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cap: { position: 'absolute', left: 0, bottom: 0 },
});
