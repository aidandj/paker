import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Item, Status, STATUS_COLOR, STATUS_LABEL, STATUSES } from '../types';

interface Props {
  item: Item;
  expanded: boolean;
  /** One-tap state change (depends on the current mode). */
  onTap: () => void;
  onToggleExpand: () => void;
  onSetStatus: (status: Status) => void;
  onRename: () => void;
  onDelete: () => void;
}

/**
 * One item. Tap the row to move it to the next state for the current mode.
 * Tap the status pill to expand all four state buttons plus rename / delete.
 */
export function ItemRow({ item, expanded, onTap, onToggleExpand, onSetStatus, onRename, onDelete }: Props) {
  const color = STATUS_COLOR[item.status];
  return (
    <View style={styles.wrap}>
      <Pressable onPress={onTap} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={[styles.bar, { backgroundColor: color }]} />
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Pressable onPress={onToggleExpand} hitSlop={8} style={[styles.pill, { backgroundColor: color }]}>
          <Text style={styles.pillText}>{STATUS_LABEL[item.status]} ▾</Text>
        </Pressable>
      </Pressable>
      {expanded && (
        <View style={styles.actions}>
          <View style={styles.statusRow}>
            {STATUSES.map((s) => {
              const active = s === item.status;
              const c = STATUS_COLOR[s];
              return (
                <Pressable
                  key={s}
                  onPress={() => onSetStatus(s)}
                  style={[styles.statusButton, { borderColor: c }, active && { backgroundColor: c }]}
                >
                  <Text style={[styles.statusButtonText, { color: active ? 'white' : c }]}>{STATUS_LABEL[s]}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.editRow}>
            <Pressable onPress={onRename} style={styles.editButton}>
              <Text style={styles.editText}>Rename</Text>
            </Pressable>
            <Pressable onPress={onDelete} style={styles.editButton}>
              <Text style={[styles.editText, styles.deleteText]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: 'white', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDD' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  pressed: { backgroundColor: '#F2F2F2' },
  bar: { width: 6, alignSelf: 'stretch' },
  name: { flex: 1, fontSize: 16, paddingHorizontal: 12 },
  pill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginRight: 12 },
  pillText: { color: 'white', fontSize: 12, fontWeight: '600' },
  actions: { paddingHorizontal: 12, paddingBottom: 10, backgroundColor: '#FAFAFA' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8 },
  statusButton: { borderWidth: 2, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, minWidth: '47%', alignItems: 'center' },
  statusButtonText: { fontSize: 14, fontWeight: '600' },
  editRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  editButton: { paddingVertical: 6, paddingHorizontal: 12 },
  editText: { fontSize: 14, color: '#2F80ED' },
  deleteText: { color: '#EB5757' },
});
