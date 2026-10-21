import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  message: { fontSize: 14, color: '#555', marginBottom: 8 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 8 },
  button: { paddingVertical: 10, paddingHorizontal: 14 },
  text: { fontSize: 16, color: '#2F80ED', fontWeight: '600' },
  destructive: { color: '#EB5757' },
  cancel: { color: '#666', fontWeight: '400' },
});
