import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ServerConfig } from '../api';
import { SyncStatus } from '../sync';
import { Theme, useStyles, useTheme } from '../theme';

interface Props {
  visible: boolean;
  config: ServerConfig | null;
  status: SyncStatus;
  error: string | null;
  onSave: (config: ServerConfig | null) => Promise<void>;
  onSyncNow: () => void;
  onClose: () => void;
}

const STATUS_TEXT: Record<SyncStatus, string> = {
  off: 'Not connected. The list is only on this device.',
  syncing: 'Syncing…',
  synced: 'Synced.',
  error: 'Could not reach the server.',
};

/** Server URL, username and password for sync. Leaving the URL empty turns sync off. */
export function SettingsModal({ visible, config, status, error, onSave, onSyncNow, onClose }: Props) {
  const [url, setUrl] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const t = useTheme();
  const styles = useStyles(makeStyles);

  useEffect(() => {
    if (!visible) return;
    // On the web build the server is wherever the page came from.
    const defaultUrl = Platform.OS === 'web' && typeof location !== 'undefined' ? location.origin : '';
    setUrl(config?.url ?? defaultUrl);
    setUser(config?.user ?? '');
    setPassword(config?.password ?? '');
    setSaveError(null);
  }, [visible, config]);

  const save = async () => {
    const u = url.trim();
    setSaving(true);
    try {
      await onSave(u ? { url: u, user: user.trim(), password } : null);
      onClose();
    } catch (e) {
      setSaveError(`Could not connect: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>Sync</Text>
          <Text style={styles.status}>
            {STATUS_TEXT[status]}
            {status === 'error' && error ? ` ${error}` : ''}
          </Text>
          <Text style={styles.note}>Connecting replaces this device's list with the server's.</Text>
          {saveError && <Text style={styles.error}>{saveError}</Text>}
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="Server URL, e.g. https://paker.example.com"
            placeholderTextColor={t.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TextInput style={styles.input} value={user} onChangeText={setUser} placeholder="Username" placeholderTextColor={t.faint} autoCapitalize="none" autoCorrect={false} />
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={t.faint} secureTextEntry autoCapitalize="none" autoCorrect={false} />
          <View style={styles.buttons}>
            {config && (
              <Pressable onPress={onSyncNow} style={styles.button}>
                <Text style={styles.secondary}>Sync now</Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Pressable onPress={onClose} style={styles.button}>
              <Text style={styles.secondary}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} style={styles.button} disabled={saving}>
              <Text style={styles.save}>{saving ? 'Connecting…' : 'Save'}</Text>
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
  title: { fontSize: 18, fontWeight: '600', marginBottom: 4, color: t.text },
  status: { fontSize: 13, color: t.muted, marginBottom: 4 },
  note: { fontSize: 12, color: t.faint, marginBottom: 12 },
  error: { fontSize: 13, color: t.danger, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: t.border, borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 8, color: t.text },
  buttons: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  button: { paddingVertical: 8, paddingHorizontal: 12 },
  secondary: { fontSize: 16, color: t.muted },
  save: { fontSize: 16, color: t.accent, fontWeight: '600' },
});
