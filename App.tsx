import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CategorySection } from './src/components/CategorySection';
import { NameModal, NameRequest } from './src/components/NameModal';
import { SettingsModal } from './src/components/SettingsModal';
import * as m from './src/model';
import { loadList, saveList } from './src/storage';
import { SyncStatus, useSync } from './src/sync';
import { Mode, PackingList } from './src/types';

const SYNC_DOT: Record<SyncStatus, string> = { off: '#BBB', syncing: '#2F80ED', synced: '#27AE60', error: '#EB5757' };

const MODES: { key: Mode; label: string }[] = [
  { key: 'planning', label: 'Planning' },
  { key: 'packing', label: 'Packing' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const [list, setList] = useState<PackingList | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [menuCategoryId, setMenuCategoryId] = useState<string | null>(null);
  const [nameRequest, setNameRequest] = useState<NameRequest | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const loaded = useRef(false);
  const sync = useSync(list, setList);

  // Load once on start; fall back to starter data on a fresh install.
  useEffect(() => {
    loadList().then((saved) => {
      setList(saved ?? m.seedList());
      loaded.current = true;
    });
  }, []);

  // Persist every change.
  useEffect(() => {
    if (list && loaded.current) saveList(list);
  }, [list]);

  if (!list) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const update = (fn: (l: PackingList) => PackingList) => setList((l) => (l ? fn(l) : l));

  const findItemName = (itemId: string) =>
    list.categories.flatMap((c) => c.items).find((i) => i.id === itemId)?.name ?? '';

  const confirmDelete = (what: string, onConfirm: () => void) =>
    Alert.alert(`Delete ${what}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);

  const showResetMenu = () =>
    Alert.alert('Reset', 'Packed items go back to "Plan to pack". With "New trip", everything is cleared except "always pack" categories. Items that need a refill are kept either way.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unpack all', onPress: () => update(m.unpackAll) },
      { text: 'New trip', style: 'destructive', onPress: () => update(m.startNewTrip) },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <Text style={styles.appTitle}>Paker</Text>
        <View style={styles.topButtons}>
          <Pressable onPress={() => setSettingsOpen(true)} style={styles.topButton}>
            <View style={[styles.syncDot, { backgroundColor: SYNC_DOT[sync.status] }]} />
            <Text style={styles.topButtonText}>Sync</Text>
          </Pressable>
          <Pressable onPress={showResetMenu} style={styles.topButton}>
            <Text style={styles.topButtonText}>Reset</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.modeBar}>
        {MODES.map(({ key, label }) => {
          const active = list.mode === key;
          return (
            <Pressable
              key={key}
              onPress={() => update((l) => m.setMode(l, key))}
              style={[styles.modeButton, active && styles.modeButtonActive]}
            >
              <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        {list.mode === 'planning'
          ? 'Tap an item to add it to or remove it from the trip.'
          : 'Tap an item when it has been packed. Only planned items are shown.'}
      </Text>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {m.live(list.categories).map((c) => (
          <CategorySection
            key={c.id}
            category={c}
            mode={list.mode}
            expandedItemId={expandedItemId}
            menuOpen={menuCategoryId === c.id}
            onToggleCollapsed={() => update((l) => m.toggleCollapsed(l, c.id))}
            onToggleMenu={() => setMenuCategoryId((id) => (id === c.id ? null : c.id))}
            onAddItem={() =>
              setNameRequest({
                title: `Add item to ${c.name}`,
                onSubmit: (name) => update((l) => m.addItem(l, c.id, name)),
              })
            }
            onRename={() =>
              setNameRequest({
                title: 'Rename category',
                initial: c.name,
                onSubmit: (name) => update((l) => m.renameCategory(l, c.id, name)),
              })
            }
            onToggleAlwaysPack={() => update((l) => m.toggleAlwaysPack(l, c.id))}
            onDelete={() => confirmDelete(`"${c.name}" and its items`, () => update((l) => m.deleteCategory(l, c.id)))}
            onTapItem={(itemId) => update((l) => m.tapItem(l, itemId))}
            onToggleItem={(itemId) => setExpandedItemId((id) => (id === itemId ? null : itemId))}
            onSetItemStatus={(itemId, status) => {
              update((l) => m.setItemStatus(l, itemId, status));
              setExpandedItemId(null);
            }}
            onRenameItem={(itemId) =>
              setNameRequest({
                title: 'Rename item',
                initial: findItemName(itemId),
                onSubmit: (name) => update((l) => m.renameItem(l, itemId, name)),
              })
            }
            onDeleteItem={(itemId) => confirmDelete(`"${findItemName(itemId)}"`, () => update((l) => m.deleteItem(l, itemId)))}
          />
        ))}
        <Pressable
          onPress={() =>
            setNameRequest({ title: 'New category', onSubmit: (name) => update((l) => m.addCategory(l, name)) })
          }
          style={styles.addCategory}
        >
          <Text style={styles.addCategoryText}>+ Add category</Text>
        </Pressable>
      </ScrollView>
      <NameModal request={nameRequest} onClose={() => setNameRequest(null)} />
      <SettingsModal
        visible={settingsOpen}
        config={sync.config}
        status={sync.status}
        error={sync.error}
        onSave={sync.setConfig}
        onSyncNow={sync.syncNow}
        onClose={() => setSettingsOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 52, backgroundColor: 'white', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CCC' },
  appTitle: { fontSize: 22, fontWeight: '700' },
  topButtons: { flexDirection: 'row' },
  topButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  syncDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  topButtonText: { fontSize: 16, color: '#2F80ED', fontWeight: '600' },
  modeBar: { flexDirection: 'row', margin: 12, marginBottom: 6, borderRadius: 10, backgroundColor: '#E1E5EC', padding: 3 },
  modeButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  modeButtonActive: { backgroundColor: 'white' },
  modeText: { fontSize: 15, fontWeight: '600', color: '#666' },
  modeTextActive: { color: '#2F80ED' },
  hint: { fontSize: 13, color: '#777', textAlign: 'center', marginBottom: 8, paddingHorizontal: 16 },
  content: { paddingBottom: 40 },
  addCategory: { margin: 16, padding: 14, borderRadius: 10, borderWidth: 2, borderColor: '#2F80ED', borderStyle: 'dashed', alignItems: 'center' },
  addCategoryText: { fontSize: 16, color: '#2F80ED', fontWeight: '600' },
});
