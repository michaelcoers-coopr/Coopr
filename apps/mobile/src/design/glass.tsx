import { useId, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { glassTheme } from './theme';

/** Navy glass stays under white type even when the map behind it is bright. */
export const GLASS_OVERLAY = glassTheme.overlay;

export function Glass({
  children,
  radius = 26,
  style,
  contentStyle,
  intensity = glassTheme.blur,
  overlay = GLASS_OVERLAY,
}: {
  children?: ReactNode;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  overlay?: string;
}) {
  const sheen = useId().replace(/:/g, '');
  return (
    <View style={[styles.shadow, { borderRadius: radius }, style]}>
      <View pointerEvents="box-none" style={[styles.clip, { borderRadius: radius }, contentStyle]}>
        <BlurView pointerEvents="none" intensity={intensity} tint={glassTheme.tint} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} />
        <Svg pointerEvents="none" style={styles.sheen} width="100%" height="46%" viewBox="0 0 100 46" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={glassTheme.sheen} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width="100" height="46" fill={`url(#${sheen})`} />
        </Svg>
        {children}
      </View>
    </View>
  );
}

/** Softens the top and bottom of a full-bleed hole so the glass can sit on it. */
export function Vignette() {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="cooprVignette" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#070B10" stopOpacity="0.28" />
          <Stop offset="0.16" stopColor="#070B10" stopOpacity="0" />
          <Stop offset="0.72" stopColor="#070B10" stopOpacity="0" />
          <Stop offset="1" stopColor="#070B10" stopOpacity="0.4" />
        </LinearGradient>
      </Defs>
      <Rect width="100" height="100" fill="url(#cooprVignette)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: glassTheme.shadow,
    shadowOpacity: glassTheme.shadowOpacity,
    shadowRadius: glassTheme.shadowRadius,
    shadowOffset: { width: 0, height: glassTheme.shadowOffsetY },
    elevation: 8,
  },
  clip: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glassTheme.border,
    flexGrow: 1,
  },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '46%' },
});
