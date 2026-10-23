import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';
import type { LatLon } from '@coopr/domain';
import { colors, play } from '@coopr/tokens';
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
  const bleed = props.bleed === true;
  const latSpan = Math.max(...lats) - Math.min(...lats);
  const lonSpan = Math.max(...lons) - Math.min(...lons);
  const latitudeDelta = Math.max(0.002, latSpan * (bleed ? 2.2 : 1.7));
  const longitudeDelta = Math.max(0.002, lonSpan * (bleed ? 1.85 : 1.7));
  const region = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2 - (bleed ? latitudeDelta * 0.1 : 0),
    longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
    latitudeDelta,
    longitudeDelta,
  };
  return (
    <View style={[styles.frame, bleed && styles.bleed, { height: props.height ?? 320 }]}>
      <MapView
        style={styles.map}
        mapType="satellite"
        initialRegion={region}
        rotateEnabled={false}
        pitchEnabled={false}
        onPress={(event) => props.onTap({ lat: event.nativeEvent.coordinate.latitude, lon: event.nativeEvent.coordinate.longitude })}
      >
        {props.fairways.map((ring, index) => (
          <Polygon key={`fairway-${index}`} coordinates={coords(ring)} fillColor={bleed ? 'rgba(31,138,76,0.2)' : 'rgba(255,255,255,0.28)'} strokeColor="rgba(255,255,255,0.7)" strokeWidth={2} />
        ))}
        {props.bunkers.map((ring, index) => (
          <Polygon key={`bunker-${index}`} coordinates={coords(ring)} fillColor={bleed ? 'rgba(228,201,138,0.38)' : 'rgba(255,255,255,0.55)'} strokeColor="rgba(255,255,255,0.8)" strokeWidth={1} />
        ))}
        {props.hazards.map((ring, index) => (
          <Polygon key={`hazard-${index}`} coordinates={coords(ring)} fillColor="rgba(200,16,46,0.45)" strokeColor={colors.red} strokeWidth={2} />
        ))}
        {props.green.map((ring, index) => (
          <Polygon key={`green-${index}`} coordinates={coords(ring)} fillColor={bleed ? 'rgba(182,242,162,0.28)' : 'rgba(255,255,255,0.72)'} strokeColor="rgba(255,255,255,0.9)" strokeWidth={2} />
        ))}
        {props.marks
          ? (['front', 'back', 'center'] as const).map((key) => {
              const point = props.marks![key];
              const primary = key === 'center';
              const label = key === 'front' ? 'F' : key === 'back' ? 'B' : 'C';
              return (
                <Marker key={key} coordinate={{ latitude: point.lat, longitude: point.lon }} tracksViewChanges={false}>
                  <View style={[styles.mark, primary && styles.markPrimary]}>
                    <Text style={[styles.markText, primary && styles.markTextPrimary]}>{label}</Text>
                  </View>
                </Marker>
              );
            })
          : null}
        {props.line.length > 1 ? <Polyline coordinates={coords(props.line)} strokeColor={bleed ? 'rgba(255,255,255,0.9)' : colors.navy} strokeWidth={3} /> : null}
        {props.ellipse && props.ellipse.length > 2 ? (
          <Polygon coordinates={coords(props.ellipse)} fillColor="rgba(11,31,58,0.28)" strokeColor={colors.white} strokeWidth={2} />
        ) : null}
        {props.dispersionLine.length > 1 ? <Polyline coordinates={coords(props.dispersionLine)} strokeColor={colors.white} strokeWidth={4} /> : null}
        {props.measure.length > 1 ? <Polyline coordinates={coords(props.measure)} strokeColor={colors.red} strokeWidth={3} /> : null}
      </MapView>
      {bleed ? null : <View pointerEvents="none" style={styles.float}>
        <View>
          <Text style={styles.kicker}>Shot</Text>
          <Text style={styles.raw}>{props.rawLabel}</Text>
        </View>
        <View>
          <Text style={styles.kicker}>Plays like</Text>
          <Text style={styles.plays}>{props.playsLabel}</Text>
        </View>
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: '#F7F5F2' },
  bleed: { borderRadius: 0, borderWidth: 0 },
  map: { flex: 1 },
  mark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  markPrimary: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.white, borderWidth: 2, borderColor: play.live },
  markText: { color: colors.navy, fontSize: 10, fontWeight: '700' },
  markTextPrimary: { fontSize: 13 },
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
