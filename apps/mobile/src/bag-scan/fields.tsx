import { StyleSheet, Text, View } from 'react-native';
import { BUILD_CHOICES, CATALOG_LINE, FLEX_CHOICES, TYPE_CHOICES } from './copy';
import { parseOptionalNumber } from './logic';
import { Body, Field, ScanChoice, scan } from './chrome';
import type { ScanDraft } from './types';

export function ClubFields({ draft, patch }: { draft: ScanDraft; patch: (partial: Partial<ScanDraft>) => void }) {
  const loft = parseOptionalNumber(draft.loftText);
  const step = (delta: number) => {
    if (loft == null) return;
    patch({ loftText: String(Math.round((loft + delta) * 10) / 10) });
  };
  return (
    <View style={styles.wrap}>
      <Body>{CATALOG_LINE}</Body>
      <Field label="Brand" value={draft.brand} onChangeText={(brand) => patch({ brand })} placeholder="Leave blank if you do not know" />
      <Field label="Model" value={draft.model} onChangeText={(model) => patch({ model })} placeholder="Leave blank if you do not know" />
      <Text style={styles.label}>Type. You pick it. The photo does not.</Text>
      <View style={styles.row}>
        {TYPE_CHOICES.map((choice) => (
          <ScanChoice key={choice.id} label={choice.label} selected={draft.type === choice.id} onPress={() => patch({ type: choice.id })} />
        ))}
      </View>
      {draft.type ? <Text style={styles.note}>you picked it</Text> : null}
      {draft.type === 'iron' ? (
        <>
          <Text style={styles.label}>Iron type. You pick it. Not from the photo.</Text>
          <View style={styles.row}>
            {BUILD_CHOICES.map((choice) => (
              <ScanChoice
                key={choice.label}
                label={choice.label}
                selected={draft.ironBuild === choice.id}
                onPress={() => patch({ ironBuild: choice.id })}
              />
            ))}
          </View>
          {draft.ironBuild ? <Text style={styles.note}>you picked it</Text> : null}
        </>
      ) : null}
      <Field label="Club number" value={draft.clubNumber} onChangeText={(clubNumber) => patch({ clubNumber })} placeholder="7, PW, 56" />
      <Field label="Loft" value={draft.loftText} onChangeText={(loftText) => patch({ loftText })} placeholder="Blank if it is not stamped" />
      <View style={styles.row}>
        <ScanChoice label="−" selected={false} onPress={() => step(-1)} />
        <ScanChoice label="+" selected={false} onPress={() => step(1)} />
      </View>
      {loft == null ? <Text style={styles.note}>A blank loft stays blank. The stepper waits until you type one.</Text> : null}
      <Text style={styles.label}>Flex</Text>
      <View style={styles.row}>
        {FLEX_CHOICES.map((choice) => (
          <ScanChoice key={choice.label} label={choice.label} selected={draft.flex === choice.id} onPress={() => patch({ flex: choice.id })} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { color: scan.white, fontWeight: '800', fontSize: 15 },
  note: { color: scan.muted, fontSize: 14 },
});
