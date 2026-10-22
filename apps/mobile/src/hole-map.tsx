import MapView, { Polygon, Polyline } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';
import type { LatLon } from '@coopr/domain';
import { colors } from '@coopr/tokens';
import type { HoleMapProps } from './hole-map-props';
import { Muted } from './ui';

export type { HoleMapProps } from './hole-map-props';

function coords(ring: readonly LatLon[]) {
  return ring.map((point) => ({ latitude: point.lat, longitude: point.lon }));
}

export function HoleMap(props: HoleMapProps) {
  const points = [props.line, ...props.fairways, ...props.green, ...props.bunkers, ...props.hazards].flat();
  if (points.length === 0) return <Muted>This hole has no open geometry to draw.</Muted>;
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  const region = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
    latitudeDelta: Math.max(0.002, (Math.max(...lats) - Math.min(...lats)) * 1.7),
    longitudeDelta: Math.max(0.002, (Math.max(...lons) - Math.min(...lons)) * 1.7),
  };
  return (
    <View style={styles.frame}>
      <MapView
        style={styles.map}
        mapType="satellite"
        initialRegion={region}
        rotateEnabled={false}
        pitchEnabled={false}
        onPress={(event) => props.onTap({ lat: event.nativeEvent.coordinate.latitude, lon: event.nativeEvent.coordinate.longitude })}
      >
        {props.fairways.map((ring, index) => (
          <Polygon key={`fairway-${index}`} coordinates={coords(ring)} fillColor="rgba(255,255,255,0.28)" strokeColor={colors.navy} strokeWidth={2} />
        ))}
        {props.bunkers.map((ring, index) => (
          <Polygon key={`bunker-${index}`} coordinates={coords(ring)} fillColor="rgba(255,255,255,0.55)" strokeColor={colors.navy} strokeWidth={1} />
        ))}
        {props.hazards.map((ring, index) => (
          <Polygon key={`hazard-${index}`} coordinates={coords(ring)} fillColor="rgba(200,16,46,0.45)" strokeColor={colors.red} strokeWidth={2} />
        ))}
        {props.green.map((ring, index) => (
          <Polygon key={`green-${index}`} coordinates={coords(ring)} fillColor="rgba(255,255,255,0.5)" strokeColor={colors.navy} strokeWidth={2} />
        ))}
        {props.line.length > 1 ? <Polyline coordinates={coords(props.line)} strokeColor={colors.navy} strokeWidth={3} /> : null}
        {props.ellipse && props.ellipse.length > 2 ? (
          <Polygon coordinates={coords(props.ellipse)} fillColor="rgba(11,31,58,0.28)" strokeColor={colors.white} strokeWidth={2} />
        ) : null}
        {props.dispersionLine.length > 1 ? <Polyline coordinates={coords(props.dispersionLine)} strokeColor={colors.white} strokeWidth={4} /> : null}
        {props.measure.length > 1 ? <Polyline coordinates={coords(props.measure)} strokeColor={colors.red} strokeWidth={3} /> : null}
      </MapView>
      <View pointerEvents="none" style={styles.float}>
        <View>
          <Text style={styles.kicker}>Raw</Text>
          <Text style={styles.raw}>{props.rawLabel}</Text>
        </View>
        <View>
          <Text style={styles.kicker}>Plays like</Text>
          <Text style={styles.plays}>{props.playsLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 360, borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: colors.navy },
  map: { flex: 1 },
  float: {
    position: 'absolute',
    zIndex: 2,
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.navy,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kicker: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  raw: { color: colors.navy, fontSize: 42, fontWeight: '800', lineHeight: 46 },
  plays: { color: colors.navy, fontSize: 42, fontWeight: '800', lineHeight: 46, textAlign: 'right' },
});
