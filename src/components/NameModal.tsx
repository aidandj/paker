import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

export interface NameRequest {
  title: string;
  initial?: string;
  /** When set, shows a "Count quantity" switch with this initial value (items only). */
  quantity?: boolean;
  onSubmit: (name: string, quantity: boolean) => void;
}

interface Props {
  request: NameRequest | null;
  onClose: () => void;
}

/** A small dialog asking for a single name. Used for adding and renaming items and categories. */
export function NameModal({ request, onClose }: Props) {
  const [text, setText] = useState('');
  const [quantity, setQuantity] = useState(false);

  useEffect(() => {
    setText(request?.initial ?? '');
    setQuantity(request?.quantity ?? false);
  }, [request]);

  const submit = () => {
    const name = text.trim();
    if (!name || !request) return;
    request.onSubmit(name, quantity);
    onClose();
  };

  return (
    <Modal visible={request !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>{request?.title}</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Name"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          {request?.quantity !== undefined && (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Count quantity (e.g. 4 shirts)</Text>
              <Switch value={quantity} onValueChange={setQuantity} />
            </View>
          )}
          <View style={styles.buttons}>
            <Pressable onPress={onClose} style={styles.button}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Pressable onPress={submit} style={styles.button}>
              <Text style={styles.save}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  switchLabel: { fontSize: 15, color: '#333' },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  button: { paddingVertical: 8, paddingHorizontal: 16 },
  cancel: { fontSize: 16, color: '#666' },
  save: { fontSize: 16, color: '#2F80ED', fontWeight: '600' },
});
