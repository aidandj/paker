import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Theme, useStyles } from '../theme';

export interface Choice {
  text: string;
  style?: 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface ChoiceRequest {
  title: string;
  message?: string;
  choices: Choice[];
}

interface Props {
  request: ChoiceRequest | null;
  onClose: () => void;
}

/** A small dialog with a few buttons. Replaces Alert, which the web build does not implement. */
export function ChoiceModal({ request, onClose }: Props) {
  const styles = useStyles(makeStyles);
  return (
    <Modal visible={request !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>{request?.title}</Text>
          {request?.message && <Text style={styles.message}>{request.message}</Text>}
          <View style={styles.buttons}>
            {request?.choices.map((c) => (
              <Pressable
                key={c.text}
                onPress={() => {
                  onClose();
                  c.onPress?.();
                }}
                style={styles.button}
              >
                <Text style={[styles.text, c.style === 'destructive' && styles.destructive, c.style === 'cancel' && styles.cancel]}>
                  {c.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: t.backdrop, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: t.card, borderRadius: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 6, color: t.text },
  message: { fontSize: 14, color: t.muted, marginBottom: 8 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 8 },
  button: { paddingVertical: 10, paddingHorizontal: 14 },
  text: { fontSize: 16, color: t.accent, fontWeight: '600' },
  destructive: { color: t.danger },
  cancel: { color: t.muted, fontWeight: '400' },
});
