// Local persistence. Swap this module out for a backend later; the rest of the app only
// calls loadList / saveList.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PackingList } from './types';

const KEY = 'paker.list.v1';

export async function loadList(): Promise<PackingList | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.categories)) return null;
    return migrate(parsed);
  } catch (e) {
    console.warn('Failed to load list', e);
    return null;
  }
}

/** Fill in fields added after the first release so old saved data still loads. */
function migrate(raw: any): PackingList {
  return {
    mode: raw.mode ?? 'planning',
    categories: raw.categories.map((c: any) => ({
      ...c,
      updatedAt: c.updatedAt ?? 0,
      items: (c.items ?? []).map((i: any) => ({ ...i, updatedAt: i.updatedAt ?? 0 })),
    })),
  };
}

export async function saveList(list: PackingList): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to save list', e);
  }
}
