import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Item, Mode, Status, STATUS_COLOR, STATUS_LABEL, STATUSES } from '../types';

interface Props {
  item: Item;
  mode: Mode;
  expanded: boolean;
  /** Multi-select mode (entered by press-and-hold): taps toggle selection instead of state. */
  selecting: boolean;
  selected: boolean;
  /** One-tap state change (depends on the current mode). */
  onTap: () => void;
  onLongPress: () => void;
  /** Quantity items: +1 / -1 on needed (planning) or packed (packing). */
  onAdjust: (delta: number) => void;
  onToggleExpand: () => void;
  onSetStatus: (status: Status) => void;
  onRename: () => void;
  onDelete: () => void;
}

/**
 * One item. Tap the row to move it to the next state for the current mode.
 * Tap the status pill to expand all four state buttons plus rename / delete.
 */
export function ItemRow({ item, mode, expanded, selecting, selected, onTap, onLongPress, onAdjust, onToggleExpand, onSetStatus, onRename, onDelete }: Props) {
  const color = STATUS_COLOR[item.status];
  const q = item.quantity;
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onTap}
        onLongPress={onLongPress}
        delayLongPress={400}
        style={({ pressed }) => [styles.row, pressed && styles.pressed, selected && styles.selected]}
      >
        <View style={[styles.bar, { backgroundColor: color }]} />
        {selecting && <Text style={[styles.check, selected && styles.checkOn]}>{selected ? '☑' : '☐'}</Text>}
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {q && !selecting && (
          <View style={styles.qty}>
            <Pressable onPress={() => onAdjust(-1)} hitSlop={8} style={styles.qtyButton}>
              <Text style={styles.qtyButtonText}>−</Text>
            </Pressable>
            <Text style={[styles.qtyNum, mode === 'planning' && styles.qtyActive]}>{q.needed}</Text>
            <Text style={styles.qtySep}>|</Text>
            <Text style={[styles.qtyNum, mode === 'packing' && styles.qtyActive]}>{q.packed}</Text>
            <Pressable onPress={() => onAdjust(1)} hitSlop={8} style={styles.qtyButton}>
              <Text style={styles.qtyButtonText}>+</Text>
            </Pressable>
          </View>
        )}
        <Pressable onPress={selecting ? onTap : onToggleExpand} hitSlop={8} style={[styles.pill, { backgroundColor: color }]}>
          <Text style={styles.pillText}>{STATUS_LABEL[item.status]}{selecting ? '' : ' ▾'}</Text>
        </Pressable>
      </Pressable>
      {expanded && !selecting && (
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
              <Text style={styles.editText}>Edit</Text>
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
  selected: { backgroundColor: '#E3EEFC' },
  check: { fontSize: 20, color: '#999', paddingLeft: 12 },
  checkOn: { color: '#2F80ED' },
  bar: { width: 6, alignSelf: 'stretch' },
  name: { flex: 1, fontSize: 16, paddingHorizontal: 12 },
  pill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginRight: 12 },
  qty: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  qtyButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF1F5', alignItems: 'center', justifyContent: 'center' },
  qtyButtonText: { fontSize: 20, color: '#333', lineHeight: 24 },
  qtyNum: { fontSize: 16, color: '#999', minWidth: 22, textAlign: 'center' },
  qtyActive: { color: '#111', fontWeight: '700' },
  qtySep: { fontSize: 16, color: '#CCC' },
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
