import { Pressable, StyleSheet, Text, View } from 'react-native';
import { countStatuses, isVisible, live } from '../model';
import { Category, Mode, Status } from '../types';
import { ItemRow } from './ItemRow';

interface Props {
  category: Category;
  mode: Mode;
  expandedItemId: string | null;
  selectedIds: string[];
  menuOpen: boolean;
  onToggleCollapsed: () => void;
  onToggleMenu: () => void;
  onAddItem: () => void;
  onRename: () => void;
  onToggleAlwaysPack: () => void;
  onDelete: () => void;
  onTapItem: (itemId: string) => void;
  onLongPressItem: (itemId: string) => void;
  onAdjustItem: (itemId: string, delta: number) => void;
  onToggleItem: (itemId: string) => void;
  onSetItemStatus: (itemId: string, status: Status) => void;
  onRenameItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
}

/** A collapsible category header with its items underneath. In packing mode, categories with nothing to pack are hidden. */
export function CategorySection(p: Props) {
  const { category, mode } = p;
  const { packed, active } = countStatuses(category);
  const items = live(category.items).filter((i) => isVisible(i, mode));
  if (mode === 'packing' && items.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Pressable onPress={p.onToggleCollapsed} style={styles.headerMain}>
          <Text style={styles.chevron}>{category.collapsed ? '▸' : '▾'}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {category.name}
          </Text>
          {category.alwaysPack && <Text style={styles.always}>always</Text>}
          <Text style={styles.count}>
            {packed}/{active}
          </Text>
        </Pressable>
        <Pressable onPress={p.onAddItem} style={styles.iconButton} hitSlop={6}>
          <Text style={styles.icon}>+</Text>
        </Pressable>
        <Pressable onPress={p.onToggleMenu} style={styles.iconButton} hitSlop={6}>
          <Text style={styles.icon}>⋯</Text>
        </Pressable>
      </View>
      {p.menuOpen && (
        <View style={styles.menu}>
          <Pressable onPress={p.onRename} style={styles.menuButton}>
            <Text style={styles.menuText}>Rename</Text>
          </Pressable>
          <Pressable onPress={p.onToggleAlwaysPack} style={styles.menuButton}>
            <Text style={styles.menuText}>{category.alwaysPack ? '✓ Always pack' : 'Always pack'}</Text>
          </Pressable>
          <Pressable onPress={p.onDelete} style={styles.menuButton}>
            <Text style={[styles.menuText, styles.deleteText]}>Delete</Text>
          </Pressable>
        </View>
      )}
      {!category.collapsed &&
        items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            mode={mode}
            expanded={item.id === p.expandedItemId}
            selecting={p.selectedIds.length > 0}
            selected={p.selectedIds.includes(item.id)}
            onTap={() => p.onTapItem(item.id)}
            onLongPress={() => p.onLongPressItem(item.id)}
            onAdjust={(delta) => p.onAdjustItem(item.id, delta)}
            onToggleExpand={() => p.onToggleItem(item.id)}
            onSetStatus={(s) => p.onSetItemStatus(item.id, s)}
            onRename={() => p.onRenameItem(item.id)}
            onDelete={() => p.onDeleteItem(item.id)}
          />
        ))}
      {!category.collapsed && items.length === 0 && (
        <Text style={styles.empty}>No items yet. Tap + to add one.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8ECF2', minHeight: 48 },
  headerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
  chevron: { fontSize: 16, width: 20, color: '#555' },
  title: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
  always: { marginLeft: 8, fontSize: 11, fontWeight: '600', color: '#2F80ED', backgroundColor: '#DCE9FB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  count: { marginLeft: 8, fontSize: 14, color: '#666' },
  iconButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 22, color: '#333' },
  menu: { flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: '#F2F4F8', paddingHorizontal: 8, paddingVertical: 4 },
  menuButton: { paddingVertical: 8, paddingHorizontal: 12 },
  menuText: { fontSize: 14, color: '#2F80ED', fontWeight: '600' },
  deleteText: { color: '#EB5757' },
  empty: { padding: 12, color: '#888', fontStyle: 'italic', backgroundColor: 'white' },
});
