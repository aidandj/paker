import { StatusBar } from 'expo-status-bar';
import { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CategorySection } from './src/components/CategorySection';
import { ChoiceModal, ChoiceRequest } from './src/components/ChoiceModal';
import { NameModal, NameRequest } from './src/components/NameModal';
import { SettingsModal } from './src/components/SettingsModal';
import { TripsModal } from './src/components/TripsModal';
import * as m from './src/model';
import { loadList, saveList } from './src/storage';
import { SyncStatus, useSync } from './src/sync';
import { Theme, ThemeContext, useStyles, useThemePreference } from './src/theme';
import { Mode, PackingList } from './src/types';

const SYNC_DOT: Record<SyncStatus, string> = { off: '#BBB', syncing: '#2F80ED', synced: '#27AE60', error: '#EB5757' };

const MODES: { key: Mode; label: string }[] = [
  { key: 'planning', label: 'Planning' },
  { key: 'packing', label: 'Packing' },
];

export default function App() {
  const themePref = useThemePreference();
  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={themePref}>
        <Main />
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}

function Main() {
  const [list, setList] = useState<PackingList | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [menuCategoryId, setMenuCategoryId] = useState<string | null>(null);
  const [nameRequest, setNameRequest] = useState<NameRequest | null>(null);
  const [choice, setChoice] = useState<ChoiceRequest | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // non-empty = multi-select mode
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tripsOpen, setTripsOpen] = useState(false);
  const loaded = useRef(false);
  const sync = useSync(list, setList);
  const { theme, toggle: toggleTheme } = useContext(ThemeContext);
  const styles = useStyles(makeStyles);

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

  const toggleSelected = (itemId: string) =>
    setSelectedIds((ids) => (ids.includes(itemId) ? ids.filter((id) => id !== itemId) : [...ids, itemId]));

  const deleteSelected = () =>
    setChoice({
      title: `Delete ${selectedIds.length} item${selectedIds.length === 1 ? '' : 's'}?`,
      choices: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            update((l) => m.deleteItems(l, selectedIds));
            setSelectedIds([]);
          },
        },
      ],
    });

  const findItem = (itemId: string) => list.categories.flatMap((c) => c.items).find((i) => i.id === itemId);
  const findItemName = (itemId: string) => findItem(itemId)?.name ?? '';

  const confirmDelete = (what: string, onConfirm: () => void) =>
    setChoice({
      title: `Delete ${what}?`,
      choices: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onConfirm },
      ],
    });

  const showResetMenu = () =>
    setChoice({
      title: 'Reset',
      message:
        'Unpack all: packed items go back to "Plan to pack". New trip: everything is cleared except "always pack" categories. Items that need a refill are kept either way.',
      choices: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unpack all', onPress: () => update(m.unpackAll) },
        { text: 'New trip', style: 'destructive', onPress: () => update(m.startNewTrip) },
      ],
    });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <View style={styles.topBar}>
        <Pressable onPress={toggleTheme} hitSlop={6} accessibilityLabel="Toggle dark mode">
          <Text style={styles.appTitle}>Paker</Text>
        </Pressable>
        <Pressable onPress={() => update((l) => m.setAllCollapsed(l, true))} style={styles.foldButton} hitSlop={6} accessibilityLabel="Collapse all">
          <Text style={styles.foldText}>▸</Text>
        </Pressable>
        <Pressable onPress={() => update((l) => m.setAllCollapsed(l, false))} style={styles.foldButton} hitSlop={6} accessibilityLabel="Expand all">
          <Text style={styles.foldText}>▾</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <View style={styles.topButtons}>
          <Pressable onPress={() => setSettingsOpen(true)} style={styles.topButton}>
            <View style={[styles.syncDot, { backgroundColor: SYNC_DOT[sync.status] }]} />
            <Text style={styles.topButtonText}>Sync</Text>
          </Pressable>
          <Pressable onPress={() => setTripsOpen(true)} style={styles.topButton}>
            <Text style={styles.topButtonText}>Trips</Text>
          </Pressable>
          <Pressable onPress={showResetMenu} style={styles.topButton}>
            <Text style={styles.topButtonText}>Reset</Text>
          </Pressable>
        </View>
      </View>
      {selectedIds.length > 0 ? (
        <View style={styles.selectBar}>
          <Text style={styles.selectText}>{selectedIds.length} selected</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => setSelectedIds([])} style={styles.topButton}>
            <Text style={styles.topButtonText}>Cancel</Text>
          </Pressable>
          <Pressable onPress={deleteSelected} style={styles.topButton}>
            <Text style={[styles.topButtonText, styles.deleteText]}>Delete</Text>
          </Pressable>
        </View>
      ) : (
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
      )}
      <Text style={styles.hint}>
        {selectedIds.length > 0
          ? 'Tap items to select them.'
          : list.mode === 'planning'
            ? 'Tap an item to add it to or remove it from the trip. Hold to select several.'
            : 'Tap an item when it has been packed. Only planned items are shown.'}
      </Text>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {m.live(list.categories).map((c) => (
          <CategorySection
            key={c.id}
            category={c}
            mode={list.mode}
            expandedItemId={expandedItemId}
            selectedIds={selectedIds}
            menuOpen={menuCategoryId === c.id}
            onToggleCollapsed={() => update((l) => m.toggleCollapsed(l, c.id))}
            onToggleMenu={() => setMenuCategoryId((id) => (id === c.id ? null : c.id))}
            onAddItem={() =>
              setNameRequest({
                title: `Add item to ${c.name}`,
                switches: { quantity: false, alwaysPack: false },
                onSubmit: (name, switches) => update((l) => m.addItem(l, c.id, name, switches)),
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
            onTapItem={(itemId) => (selectedIds.length > 0 ? toggleSelected(itemId) : update((l) => m.tapItem(l, itemId)))}
            onAdjustItem={(itemId, delta) =>
              update((l) => (l.mode === 'planning' ? m.adjustNeeded(l, itemId, delta) : m.adjustPacked(l, itemId, delta)))
            }
            onLongPressItem={(itemId) => {
              setExpandedItemId(null);
              toggleSelected(itemId);
            }}
            onToggleItem={(itemId) => setExpandedItemId((id) => (id === itemId ? null : itemId))}
            onSetItemStatus={(itemId, status) => {
              update((l) => m.setItemStatus(l, itemId, status));
              setExpandedItemId(null);
            }}
            onRenameItem={(itemId) =>
              setNameRequest({
                title: 'Edit item',
                initial: findItemName(itemId),
                switches: { quantity: m.hasQuantity(findItem(itemId)!), alwaysPack: !!findItem(itemId)?.alwaysPack },
                onSubmit: (name, switches) => update((l) => m.editItem(l, itemId, name, switches)),
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
      <ChoiceModal request={choice} onClose={() => setChoice(null)} />
      <TripsModal
        visible={tripsOpen}
        trips={m.live(list.trips)}
        onClose={() => setTripsOpen(false)}
        onSave={() => {
          setTripsOpen(false);
          setNameRequest({
            title: 'Save trip as',
            onSubmit: (name) => update((l) => m.saveTrip(l, name)),
          });
        }}
        onLoad={(tripId) => {
          setTripsOpen(false);
          const trip = list.trips.find((t) => t.id === tripId);
          setChoice({
            title: `Load "${trip?.name}"?`,
            message: 'Every item gets the state it had when the trip was saved; items not in it become Not packed.',
            choices: [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Load', onPress: () => update((l) => m.loadTrip(l, tripId)) },
            ],
          });
        }}
        onDelete={(tripId) => {
          const trip = list.trips.find((t) => t.id === tripId);
          setTripsOpen(false);
          confirmDelete(`trip "${trip?.name}"`, () => update((l) => m.deleteTrip(l, tripId)));
        }}
      />
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

const makeStyles = (t: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 52, backgroundColor: t.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  appTitle: { fontSize: 22, fontWeight: '700', marginRight: 10, color: t.text },
  foldButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  foldText: { fontSize: 15, color: t.muted },
  topButtons: { flexDirection: 'row' },
  topButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  syncDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  topButtonText: { fontSize: 16, color: t.accent, fontWeight: '600' },
  selectBar: { flexDirection: 'row', alignItems: 'center', margin: 12, marginBottom: 6, borderRadius: 10, backgroundColor: t.selected, paddingLeft: 12, minHeight: 42 },
  selectText: { fontSize: 15, fontWeight: '600', color: t.accent },
  deleteText: { color: t.danger },
  modeBar: { flexDirection: 'row', margin: 12, marginBottom: 6, borderRadius: 10, backgroundColor: t.modeBar, padding: 3 },
  modeButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  modeButtonActive: { backgroundColor: t.card },
  modeText: { fontSize: 15, fontWeight: '600', color: t.muted },
  modeTextActive: { color: t.accent },
  hint: { fontSize: 13, color: t.faint, textAlign: 'center', marginBottom: 8, paddingHorizontal: 16 },
  content: { paddingBottom: 40 },
  addCategory: { margin: 16, padding: 14, borderRadius: 10, borderWidth: 2, borderColor: t.accent, borderStyle: 'dashed', alignItems: 'center' },
  addCategoryText: { fontSize: 16, color: t.accent, fontWeight: '600' },
});
