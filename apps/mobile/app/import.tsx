import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '@coopr/tokens';
import {
  buildPhotoReview,
  refreshReviewItem,
  samplePhotoExtraction,
  type PhotoReviewItem,
} from '@coopr/engine';
import type { EnvironmentName } from '@coopr/domain';
import { extractionUrl, requestExtraction } from '../src/extract-client';
import { useLocalStore } from '../src/local-store';
import { Button, Card, Choice, Muted, Screen, Title } from '../src/ui';

const ENVIRONMENTS: { id: EnvironmentName | null; label: string }[] = [
  { id: null, label: 'No environment' },
  { id: 'simulator', label: 'Simulator' },
  { id: 'range', label: 'Range' },
  { id: 'course', label: 'Course' },
];

function blank(value: string | null): string {
  return value ?? '';
}

export default function ImportScreen() {
  const { photoExisting, savePhotoImport, founderTools } = useLocalStore();
  const [items, setItems] = useState<PhotoReviewItem[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [banner, setBanner] = useState(
    extractionUrl()
      ? 'Photos go to the extraction server and are not kept there. You review every number before it is saved.'
      : founderTools
        ? 'No extraction server is set. Camera and library will not pretend to read a photo. The sample below is a fixture.'
        : 'No extraction server is set. Camera and library will not pretend to read a photo. The photo stays on this phone.',
  );
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [applyStrokes, setApplyStrokes] = useState(false);
  const [keepPhoto, setKeepPhoto] = useState(false);
  const [pendingUris, setPendingUris] = useState<string[]>([]);
  const [allowSave, setAllowSave] = useState(false);
  const [saved, setSaved] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const openSample = () => {
    const sample = samplePhotoExtraction();
    setItems(buildPhotoReview(sample, photoExisting()));
    setNotes(sample.notes);
    setPendingUris([]);
    setKeepPhoto(false);
    setApplyStrokes(false);
    setAllowSave(true);
    setSaved('');
    setDrafts({});
    setBanner('Sample fixture. No photo was read. Unreadable fields stay empty. Saving stores these sample rows on this phone.');
  };

  const pick = async (kind: 'camera' | 'library') => {
    setSaved('');
    if (!extractionUrl()) {
      setBanner(
        founderTools
          ? 'No extraction server is set on this build. The photo stays on this phone and was not read. Use Review a sample extraction to try the screen.'
          : 'No extraction server is set on this build. The photo stays on this phone and was not read.',
      );
      return;
    }
    setBusy(true);
    try {
      const permission =
        kind === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setBanner('Photo access was declined. Nothing was sent.');
        return;
      }
      const result =
        kind === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, base64: true })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsMultipleSelection: true,
              quality: 0.5,
              base64: true,
              selectionLimit: 8,
            });
      if (result.canceled || result.assets.length === 0) return;
      const collected: PhotoReviewItem[] = [];
      const nextNotes: string[] = [];
      const uris: string[] = [];
      let unread = false;
      let live = false;
      for (const [index, asset] of result.assets.entries()) {
        if (!asset.base64) {
          nextNotes.push(`Photo ${index + 1} had no image data, so it was not sent.`);
          continue;
        }
        const extracted = await requestExtraction({
          imageBase64: asset.base64,
          mediaType: asset.mimeType ?? 'image/jpeg',
          token,
        });
        if ('error' in extracted) {
          nextNotes.push(extracted.error);
          continue;
        }
        if (extracted.readFromImage) live = true;
        else unread = true;
        nextNotes.push(...extracted.notes);
        collected.push(
          ...buildPhotoReview(extracted, photoExisting()).map((item) => ({
            ...item,
            id: `p${index + 1}-${item.id}`,
          })),
        );
        if (asset.uri) uris.push(asset.uri);
      }
      if (collected.length === 0) {
        setBanner(nextNotes.join(' ') || 'Nothing was extracted. Nothing was invented.');
        setItems(null);
        return;
      }
      setItems(collected);
      setNotes(nextNotes);
      setPendingUris(uris);
      setKeepPhoto(false);
      setApplyStrokes(false);
      setDrafts({});
      setAllowSave(live && !unread);
      setBanner(
        unread
          ? 'The server did not read the photo. These rows are a sample, so Save stays off. Nothing from the picture was invented.'
          : 'Read from the photo. Check every number. Unreadable fields stay empty. The server did not keep the image.',
      );
    } catch (error) {
      setBanner(error instanceof Error ? error.message : 'The photo picker failed. Nothing was saved.');
    } finally {
      setBusy(false);
    }
  };

  const patchItem = (item: PhotoReviewItem, patch: Partial<PhotoReviewItem>) => {
    setItems((current) => current?.map((row) => (row.id === item.id ? refreshReviewItem(row, patch, photoExisting()) : row)) ?? current);
  };

  const numberDraft = (item: PhotoReviewItem, field: 'carry' | 'total' | 'side' | 'yards' | 'sampleSize' | 'par' | 'strokeIndex' | 'yardage' | 'strokes' | 'loft' | 'hole') => {
    const key = `${item.id}:${field}`;
    if (key in drafts) return drafts[key] ?? '';
    const value = item[field];
    return value == null ? '' : String(value);
  };

  const commitNumber = (
    item: PhotoReviewItem,
    field: 'carry' | 'total' | 'side' | 'yards' | 'sampleSize' | 'par' | 'strokeIndex' | 'yardage' | 'strokes' | 'loft' | 'hole',
    text: string,
  ) => {
    setDrafts((current) => ({ ...current, [`${item.id}:${field}`]: text }));
    const trimmed = text.trim();
    if (trimmed === '') {
      patchItem(item, { [field]: null });
      return;
    }
    const value = Number(trimmed);
    if (!Number.isFinite(value)) return;
    patchItem(item, { [field]: field === 'side' || field === 'loft' || field === 'yards' || field === 'carry' || field === 'total' || field === 'yardage' ? value : Math.trunc(value) });
  };

  return (
    <Screen>
      <Title>Add from photos</Title>
      <Muted>Launch monitor, another golf app, a scorecard, or the clubs themselves. Nothing saves until you review it.</Muted>
      <Card warning={!allowSave && items != null}>
        <Muted>{banner}</Muted>
        {notes
          .filter((note) => !banner.includes(note))
          .map((note) => (
            <Muted key={note}>{note}</Muted>
          ))}
      </Card>
      <Button label={busy ? 'Reading…' : 'Take a photo'} onPress={() => void pick('camera')} />
      <Button label="Choose from the library" tone="ghost" onPress={() => void pick('library')} />
      {founderTools ? <Button label="Review a sample extraction" tone="ghost" onPress={openSample} /> : null}
      {saved ? (
        <Card>
          <Muted>{saved}</Muted>
        </Card>
      ) : null}
      <Card>
        <Text style={styles.label}>Session token</Text>
        <Muted>Optional. Typed here, kept for this screen only, and never stored in the app.</Muted>
        <TextInput
          value={token}
          onChangeText={setToken}
          secureTextEntry
          placeholder="Leave blank if the server has no token"
          placeholderTextColor={colors.muted}
          style={styles.input}
          accessibilityLabel="Extraction session token"
        />
      </Card>
      {items == null ? null : (
        <>
          <Choice label={applyStrokes ? 'Strokes will go on blank High Cedars holes' : 'Leave the High Cedars card alone'} selected={applyStrokes} onPress={() => setApplyStrokes((value) => !value)} />
          <Muted>Photo pars and yardages stay on this import. They do not replace the open course.</Muted>
          <Choice
            label={keepPhoto ? 'Keep the photo on this phone for this session' : 'Do not keep the photo'}
            selected={keepPhoto}
            onPress={() => setKeepPhoto((value) => !value)}
          />
          <Muted>{pendingUris.length === 0 ? 'This review has no photo to keep.' : 'Default is off. The server already discarded its copy.'}</Muted>
          {items.map((item) => (
            <Card key={item.id} warning={Boolean(item.blockedReason || item.duplicateReason)}>
              <Text style={styles.label}>{heading(item)}</Text>
              <Muted>{item.confidenceNote}</Muted>
              {item.blockedReason ? <Muted>{item.blockedReason}</Muted> : null}
              {item.duplicateReason ? <Muted>{item.duplicateReason}</Muted> : null}
              <Choice
                label={item.include ? 'Include' : 'Leave out'}
                selected={item.include}
                onPress={() => {
                  if (item.blockedReason) return;
                  setItems((current) => current?.map((row) => (row.id === item.id ? { ...row, include: !row.include } : row)) ?? current);
                }}
              />
              <TextInput
                value={blank(item.sourceApp)}
                onChangeText={(text) => patchItem(item, { sourceApp: text.trim() ? text : null })}
                placeholder="Source app, or blank"
                placeholderTextColor={colors.muted}
                style={styles.input}
                accessibilityLabel={`${item.id} source app`}
              />
              <TextInput
                value={blank(item.capturedOn)}
                onChangeText={(text) => patchItem(item, { capturedOn: text.trim() ? text : null })}
                placeholder="Date YYYY-MM-DD, or blank"
                placeholderTextColor={colors.muted}
                style={styles.input}
                accessibilityLabel={`${item.id} date`}
              />
              {item.group === 'shot' || item.group === 'reported' ? (
                <TextInput
                  value={blank(item.club)}
                  onChangeText={(text) => patchItem(item, { club: text.trim() ? text : null })}
                  placeholder="Club"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  accessibilityLabel={`${item.id} club`}
                />
              ) : null}
              {item.group === 'shot' ? (
                <View style={styles.row}>
                  <TextInput value={numberDraft(item, 'carry')} onChangeText={(text) => commitNumber(item, 'carry', text)} placeholder="Carry" keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={[styles.input, styles.half]} accessibilityLabel={`${item.id} carry`} />
                  <TextInput value={numberDraft(item, 'total')} onChangeText={(text) => commitNumber(item, 'total', text)} placeholder="Total" keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={[styles.input, styles.half]} accessibilityLabel={`${item.id} total`} />
                </View>
              ) : null}
              {item.group === 'shot' ? (
                <TextInput value={numberDraft(item, 'side')} onChangeText={(text) => commitNumber(item, 'side', text)} placeholder="Side, blank if unknown" keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel={`${item.id} side`} />
              ) : null}
              {item.group === 'reported' ? (
                <>
                  <Muted>{item.metric == null ? 'Carry or total is unknown.' : `Marked as ${item.metric}.`}</Muted>
                  <View style={styles.row}>
                    <Choice label="Carry" selected={item.metric === 'carry'} onPress={() => patchItem(item, { metric: 'carry' })} />
                    <Choice label="Total" selected={item.metric === 'total'} onPress={() => patchItem(item, { metric: 'total' })} />
                  </View>
                  <TextInput value={numberDraft(item, 'yards')} onChangeText={(text) => commitNumber(item, 'yards', text)} placeholder="Yards" keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel={`${item.id} yards`} />
                  <TextInput value={numberDraft(item, 'sampleSize')} onChangeText={(text) => commitNumber(item, 'sampleSize', text)} placeholder="Sample size, blank if unknown" keyboardType="number-pad" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel={`${item.id} sample size`} />
                  <Muted>Their reported number. It counts only after you name an environment, and then at a quarter of a COOPR measurement.</Muted>
                  <View style={styles.row}>
                    {ENVIRONMENTS.map((option) => (
                      <Choice key={option.label} label={option.label} selected={item.environment === option.id} onPress={() => patchItem(item, { environment: option.id })} />
                    ))}
                  </View>
                </>
              ) : null}
              {item.group === 'score' ? (
                <>
                  <TextInput
                    value={blank(item.courseName)}
                    onChangeText={(text) => patchItem(item, { courseName: text.trim() ? text : null })}
                    placeholder="Course name"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                    accessibilityLabel={`${item.id} course`}
                  />
                  <View style={styles.row}>
                    <TextInput value={numberDraft(item, 'hole')} onChangeText={(text) => commitNumber(item, 'hole', text)} placeholder="Hole" keyboardType="number-pad" placeholderTextColor={colors.muted} style={[styles.input, styles.half]} accessibilityLabel={`${item.id} hole`} />
                    <TextInput value={numberDraft(item, 'par')} onChangeText={(text) => commitNumber(item, 'par', text)} placeholder="Par" keyboardType="number-pad" placeholderTextColor={colors.muted} style={[styles.input, styles.half]} accessibilityLabel={`${item.id} par`} />
                  </View>
                  <View style={styles.row}>
                    <TextInput value={numberDraft(item, 'strokeIndex')} onChangeText={(text) => commitNumber(item, 'strokeIndex', text)} placeholder="SI" keyboardType="number-pad" placeholderTextColor={colors.muted} style={[styles.input, styles.half]} accessibilityLabel={`${item.id} stroke index`} />
                    <TextInput value={numberDraft(item, 'yardage')} onChangeText={(text) => commitNumber(item, 'yardage', text)} placeholder="Yardage" keyboardType="number-pad" placeholderTextColor={colors.muted} style={[styles.input, styles.half]} accessibilityLabel={`${item.id} yardage`} />
                  </View>
                  <TextInput value={numberDraft(item, 'strokes')} onChangeText={(text) => commitNumber(item, 'strokes', text)} placeholder="Strokes, blank if unknown" keyboardType="number-pad" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel={`${item.id} strokes`} />
                </>
              ) : null}
              {item.group === 'club' ? (
                <>
                  <TextInput value={blank(item.brand)} onChangeText={(text) => patchItem(item, { brand: text.trim() ? text : null })} placeholder="Brand" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel={`${item.id} brand`} />
                  <TextInput value={blank(item.model)} onChangeText={(text) => patchItem(item, { model: text.trim() ? text : null })} placeholder="Model" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel={`${item.id} model`} />
                  <TextInput value={numberDraft(item, 'loft')} onChangeText={(text) => commitNumber(item, 'loft', text)} placeholder="Loft" keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel={`${item.id} loft`} />
                  <TextInput value={blank(item.shaft)} onChangeText={(text) => patchItem(item, { shaft: text.trim() ? text : null })} placeholder="Shaft, blank if unreadable" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel={`${item.id} shaft`} />
                </>
              ) : null}
            </Card>
          ))}
          <Button
            label="Save reviewed rows"
            onPress={() => {
              if (!items || !allowSave) return;
              const result = savePhotoImport({
                items,
                applyStrokes,
                imageUris: keepPhoto ? pendingUris : [],
              });
              setSaved(result.message);
              if (result.saved) {
                setItems(null);
                setAllowSave(false);
              }
            }}
          />
          {!allowSave ? <Muted>Save is off because the photo was not read.</Muted> : null}
        </>
      )}
    </Screen>
  );
}

function heading(item: PhotoReviewItem): string {
  if (item.group === 'shot') return item.club ? `${item.club} shot` : 'Shot, club unknown';
  if (item.group === 'reported') return item.club ? `${item.club}, their reported number` : 'Reported number, club unknown';
  if (item.group === 'score') return `Scorecard hole ${item.hole ?? '—'}`;
  return [item.brand, item.model, item.loft != null ? `${item.loft}°` : null].filter(Boolean).join(' ') || 'Club, unread';
}

const styles = StyleSheet.create({
  label: { color: colors.navy, fontSize: 22, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  half: { flex: 1, minWidth: 120 },
  input: {
    color: colors.navy,
    backgroundColor: colors.white,
    borderColor: colors.navy,
    borderWidth: 2,
    borderRadius: 14,
    minHeight: 56,
    paddingHorizontal: 14,
    fontSize: 18,
  },
});
