import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Theme, useStyles, useTheme } from '../theme';

export interface ItemSwitches {
  quantity: boolean;
  alwaysPack: boolean;
}

export interface NameRequest {
  title: string;
  initial?: string;
  /** When set, shows the item switches with these initial values (items only). */
  switches?: ItemSwitches;
  onSubmit: (name: string, switches: ItemSwitches) => void;
}

interface Props {
  request: NameRequest | null;
  onClose: () => void;
}

/** A small dialog asking for a single name. Used for adding and renaming items and categories. */
export function NameModal({ request, onClose }: Props) {
  const [text, setText] = useState('');
  const [switches, setSwitches] = useState<ItemSwitches>({ quantity: false, alwaysPack: false });
  const t = useTheme();
  const styles = useStyles(makeStyles);

  useEffect(() => {
    setText(request?.initial ?? '');
    setSwitches(request?.switches ?? { quantity: false, alwaysPack: false });
  }, [request]);

  const submit = () => {
    const name = text.trim();
    if (!name || !request) return;
    request.onSubmit(name, switches);
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
            placeholderTextColor={t.faint}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          {request?.switches && (
            <>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Count quantity (e.g. 4 shirts)</Text>
                <Switch value={switches.quantity} onValueChange={(v) => setSwitches((s) => ({ ...s, quantity: v }))} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Always pack (planned on every new trip)</Text>
                <Switch value={switches.alwaysPack} onValueChange={(v) => setSwitches((s) => ({ ...s, alwaysPack: v }))} />
              </View>
            </>
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

const makeStyles = (t: Theme) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: t.backdrop, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: t.card, borderRadius: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: t.text },
  input: { borderWidth: 1, borderColor: t.border, borderRadius: 8, padding: 10, fontSize: 16, color: t.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  switchLabel: { fontSize: 15, color: t.text },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  button: { paddingVertical: 8, paddingHorizontal: 16 },
  cancel: { fontSize: 16, color: t.muted },
  save: { fontSize: 16, color: t.accent, fontWeight: '600' },
});
