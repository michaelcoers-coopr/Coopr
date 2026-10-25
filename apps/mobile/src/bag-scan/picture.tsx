import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { AI_RENDER, PHOTO_CLUBFACE } from './copy';
import { clubPictureKind } from './picture-kind';

const RENDERS: Record<string, ImageSourcePropType> = {
  driver: require('../../assets/bag-scan/ai_driver.png'),
  'fairway wood': require('../../assets/bag-scan/ai_fairway.png'),
  hybrid: require('../../assets/bag-scan/ai_hybrid.png'),
  iron: require('../../assets/bag-scan/ai_iron.png'),
  'utility iron': require('../../assets/bag-scan/ai_iron.png'),
  wedge: require('../../assets/bag-scan/ai_wedge.png'),
  putter: require('../../assets/bag-scan/ai_putter.png'),
};

export function ClubPicture({
  photoUri,
  type,
  size = 96,
  onPhoto,
}: {
  photoUri: string | null;
  type: string | null;
  size?: number;
  onPhoto?: () => void;
}) {
  const [missing, setMissing] = useState(false);
  const kind = missing ? clubPictureKind(null, type) : clubPictureKind(photoUri, type);
  if (kind === 'photo' && photoUri) {
    return (
      <Image
        accessibilityLabel="Your clubface photo"
        source={{ uri: photoUri }}
        onError={() => setMissing(true)}
        style={{ width: size, height: size, borderRadius: 16 }}
      />
    );
  }
  if (kind === 'render' && type && RENDERS[type]) {
    return (
      <View style={{ width: size, height: size }}>
        <Image accessibilityLabel="AI render of this club type" source={RENDERS[type]} style={{ width: size, height: size, borderRadius: 16 }} />
        <Text style={styles.tag}>{AI_RENDER}</Text>
      </View>
    );
  }
  const empty = (
    <View style={[styles.empty, { width: size, height: size }]}>
      <Text style={styles.emptyText}>{PHOTO_CLUBFACE}</Text>
    </View>
  );
  if (!onPhoto) return empty;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={PHOTO_CLUBFACE} onPress={onPhoto}>
      {empty}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tag: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    backgroundColor: '#0B1F3A',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  empty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  emptyText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', textAlign: 'center' },
});
