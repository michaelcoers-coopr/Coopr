import { useEffect, useRef, useState } from 'react';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';
import type { LatLon } from '@coopr/domain';
import { colors, font } from '@coopr/tokens';
import { shotBearing } from '@coopr/engine';
import type { HoleMapProps } from './hole-map-props';
import { Muted } from './ui';

export type { HoleMapProps } from './hole-map-props';

function coords(ring: readonly LatLon[]) {
  return ring.map((point) => ({ latitude: point.lat, longitude: point.lon }));
}

const MARK_NAME = { front: 'Front', center: 'Center', back: 'Back' } as const;

export function HoleMap(props: HoleMapProps) {
  const [flash, setFlash] = useState<'front' | 'center' | 'back' | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );
  const points = [props.line, ...props.fairways, ...props.green, ...props.bunkers, ...props.hazards].flat();
  if (points.length === 0) return <Muted>This hole has no open geometry to draw.</Muted>;
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  const bleed = props.bleed === true;
  const latSpan = Math.max(...lats) - Math.min(...lats);
  const lonSpan = Math.max(...lons) - Math.min(...lons);
  const span = Math.max(latSpan, lonSpan, 0.002);
  const latitudeDelta = Math.max(0.002, span * (bleed ? 1.65 : 1.7));
  const longitudeDelta = Math.max(0.002, span * (bleed ? 1.65 : 1.7));
  const latitude = (Math.min(...lats) + Math.max(...lats)) / 2;
  const longitude = (Math.min(...lons) + Math.max(...lons)) / 2;
  const region = { latitude, longitude, latitudeDelta, longitudeDelta };
  const bearing = props.orient?.bearing ?? shotBearing(props.line);
  const meters = span * 111_320;
  const camera =
    bleed && bearing != null
      ? {
          center: { latitude, longitude },
          pitch: 0,
          heading: bearing,
          altitude: Math.max(480, meters * 2.2),
          zoom: Math.max(14, Math.min(17.2, 17.4 - Math.log2(Math.max(meters, 160) / 220))),
        }
      : null;
  return (
    <View style={[styles.frame, bleed && styles.bleed, { height: props.height ?? 320 }]}>
      <MapView
        style={styles.map}
        mapType="satellite"
        {...(camera ? { initialCamera: camera } : { initialRegion: region })}
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
          ? (['front', 'center', 'back'] as const).map((key) => {
              const point = props.marks![key];
              const readout = flash === key ? props.markReadout?.[key] : null;
              return (
                <Marker
                  key={key}
                  coordinate={{ latitude: point.lat, longitude: point.lon }}
                  tracksViewChanges
                  anchor={{ x: 0.5, y: 0.5 }}
                  onPress={() => {
                    const text = props.markReadout?.[key];
                    if (!text || text === '—') return;
                    setFlash(key);
                    if (flashTimer.current) clearTimeout(flashTimer.current);
                    flashTimer.current = setTimeout(() => setFlash(null), 1400);
                  }}
                >
                  <View
                    style={styles.markWrap}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={props.markAccess?.[key] ?? MARK_NAME[key]}
                  >
                    <View style={styles.dot} />
                    {readout && readout !== '—' ? (
                      <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.readout}>
                        {readout}
                      </Text>
                    ) : null}
                  </View>
                </Marker>
              );
            })
          : null}
        {props.line.length > 1 ? <Polyline coordinates={coords(props.line)} strokeColor={bleed ? 'rgba(255,255,255,0.9)' : colors.navy} strokeWidth={3} /> : null}
        {props.ellipse && props.ellipse.length > 2 ? (
          <Polygon coordinates={coords(props.ellipse)} fillColor={props.ellipseColor ?? '#8AC926'} strokeColor={props.ellipseColor ?? '#8AC926'} strokeWidth={2} />
        ) : null}
        {props.ellipse && props.ellipse.length > 2 && props.ellipseCaption ? (
          <Marker
            coordinate={{
              latitude: props.ellipse.reduce((sum, point) => sum + point.lat, 0) / props.ellipse.length,
              longitude: props.ellipse.reduce((sum, point) => sum + point.lon, 0) / props.ellipse.length,
            }}
            anchor={{ x: 0.5, y: 1.4 }}
            tracksViewChanges={false}
          >
            <Text style={styles.sampleMark}>{props.ellipseCaption}</Text>
          </Marker>
        ) : null}
        {props.flight && props.flight.length > 1 ? <Polyline coordinates={coords(props.flight)} strokeColor="#FFFFFF" strokeWidth={3} /> : null}
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
  markWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0B1F3A',
  },
  sampleMark: {
    color: '#FFFFFF',
    backgroundColor: 'rgba(11,31,58,0.92)',
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    fontFamily: font.family,
    fontSize: 11,
    fontWeight: '700',
  },
  readout: {
    position: 'absolute',
    top: 28,
    color: '#FFFFFF',
    backgroundColor: 'rgba(11,31,58,0.92)',
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontFamily: font.family,
    fontSize: 13,
    fontWeight: '700',
  },
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
