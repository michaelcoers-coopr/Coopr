import QRCode from 'qrcode';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

/** Join link as a navy mark. No third-party image host. */
export function JoinQr({ value, size }: { value: string; size: number }) {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const count = qr.modules.size;
  const cell = size / count;
  const marks = [];
  for (let y = 0; y < count; y += 1) {
    for (let x = 0; x < count; x += 1) {
      if (!qr.modules.get(y, x)) continue;
      marks.push(<Rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill="#0B1F3A" />);
    }
  }
  return (
    <View style={{ width: size, height: size, backgroundColor: '#FFFFFF' }}>
      <Svg width={size} height={size}>{marks}</Svg>
    </View>
  );
}
