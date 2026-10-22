import Svg, { Path } from 'react-native-svg';
import type { ResultIcon } from './icons';

/** SF Symbols-style line marks. One weight, one color, no filled pictograms. */
export function Mark({ name, color }: { name: ResultIcon | 'minus' | 'plus'; color: string }) {
  const pen = { fill: 'none' as const, stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {name === 'flag' ? (
        <>
          <Path d="M6 21 V4" {...pen} />
          <Path d="M6 5 h11 l-2.2 3.2 L17 11.4 H6" {...pen} />
        </>
      ) : null}
      {name === 'left' ? <Path d="M18 12 H6 M10 7 L5 12 l5 5" {...pen} /> : null}
      {name === 'right' ? <Path d="M6 12 h12 M14 7 l5 5 -5 5" {...pen} /> : null}
      {name === 'down' ? <Path d="M12 5 v14 M7 14 l5 5 5 -5" {...pen} /> : null}
      {name === 'hazard' ? <Path d="M12 3.5 20.5 19 H3.5 Z M12 9 v5 M12 16.5 v.5" {...pen} /> : null}
      {name === 'minus' ? <Path d="M6 12 h12" {...pen} /> : null}
      {name === 'plus' ? <Path d="M12 6 v12 M6 12 h12" {...pen} /> : null}
    </Svg>
  );
}
