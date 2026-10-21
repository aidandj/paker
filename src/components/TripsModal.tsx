import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Theme, useStyles } from '../theme';
import { SavedTrip } from '../types';

interface Props {
  visible: boolean;
  trips: SavedTrip[];
  onSave: () => void;
  onLoad: (tripId: string) => void;
  onDelete: (tripId: string) => void;
  onClose: () => void;
}

/** Saved trips: load one, delete one, or save the current list under a name. */
export function TripsModal({ visible, trips, onSave, onLoad, onDelete, onClose }: Props) {
  const styles = useStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>Saved trips</Text>
          <Text style={styles.empty}>
            {trips.length === 0
              ? 'No saved trips yet. A trip remembers which items go and how many.'
              : 'A trip remembers which items go and how many. Saving with an existing name replaces it.'}
          </Text>
          <ScrollView style={styles.list}>
            {trips.map((t) => (
              <View key={t.id} style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>
                  {t.name}
                </Text>
                <Pressable onPress={() => onDelete(t.id)} style={styles.button} hitSlop={6}>
                  <Text style={styles.delete}>Delete</Text>
                </Pressable>
                <Pressable onPress={() => onLoad(t.id)} style={styles.button} hitSlop={6}>
                  <Text style={styles.load}>Load</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
          <View style={styles.buttons}>
            <Pressable onPress={onSave} style={styles.button}>
              <Text style={styles.load}>Save current list as trip…</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onClose} style={styles.button}>
              <Text style={styles.cancel}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: t.backdrop, justifyContent: 'center', padding: 24 },
    card: { backgroundColor: t.card, borderRadius: 12, padding: 16, maxHeight: '80%' },
    title: { fontSize: 18, fontWeight: '600', marginBottom: 8, color: t.text },
    empty: { fontSize: 14, color: t.muted, marginBottom: 8 },
    list: { flexGrow: 0 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator },
    name: { flex: 1, fontSize: 16, color: t.text },
    buttons: { flexDirection: 'row', alignItems: 'center', marginTop: 12, flexWrap: 'wrap' },
    button: { paddingVertical: 8, paddingHorizontal: 10 },
    load: { fontSize: 16, color: t.accent, fontWeight: '600' },
    delete: { fontSize: 15, color: t.danger },
    cancel: { fontSize: 16, color: t.muted },
  });
