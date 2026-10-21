// Pure functions over PackingList. No React, no storage. Every function returns a new list.
import type { Category, Item, Mode, PackingList, Status } from './types';

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const now = () => Date.now();

/** Deleted entities are kept as tombstones for sync; the UI uses these to hide them. */
export const live = <T extends { deleted?: boolean }>(xs: T[]): T[] => xs.filter((x) => !x.deleted);

function mapCategory(list: PackingList, id: string, fn: (c: Category) => Category): PackingList {
  return { ...list, categories: list.categories.map((c) => (c.id === id ? fn(c) : c)) };
}

function mapItems(list: PackingList, fn: (item: Item, category: Category) => Item): PackingList {
  return {
    ...list,
    categories: list.categories.map((c) => ({ ...c, items: c.items.map((i) => fn(i, c)) })),
  };
}

// --- mode ---

export function setMode(list: PackingList, mode: Mode): PackingList {
  return { ...list, mode };
}

/** Which items are shown in a mode. Packing mode only shows items that are on the trip. */
export function isVisible(item: Item, mode: Mode): boolean {
  return mode === 'planning' || item.status !== 'not_packed';
}

/** The status an item moves to when tapped once in the given mode. */
export function nextStatusOnTap(status: Status, mode: Mode): Status {
  if (mode === 'planning') return status === 'not_packed' ? 'planned' : 'not_packed';
  return status === 'packed' ? 'planned' : 'packed';
}

export function tapItem(list: PackingList, itemId: string): PackingList {
  return mapItems(list, (i) =>
    i.id === itemId ? { ...i, status: nextStatusOnTap(i.status, list.mode), updatedAt: now() } : i,
  );
}

// --- categories ---

export function addCategory(list: PackingList, name: string): PackingList {
  const category: Category = { id: newId(), name, alwaysPack: false, collapsed: false, updatedAt: now(), items: [] };
  return { ...list, categories: [...list.categories, category] };
}

export function renameCategory(list: PackingList, id: string, name: string): PackingList {
  return mapCategory(list, id, (c) => ({ ...c, name, updatedAt: now() }));
}

export function deleteCategory(list: PackingList, id: string): PackingList {
  return mapCategory(list, id, (c) => ({ ...c, deleted: true, updatedAt: now() }));
}

export function toggleCollapsed(list: PackingList, id: string): PackingList {
  return mapCategory(list, id, (c) => ({ ...c, collapsed: !c.collapsed }));
}

export function toggleAlwaysPack(list: PackingList, id: string): PackingList {
  return mapCategory(list, id, (c) => ({ ...c, alwaysPack: !c.alwaysPack, updatedAt: now() }));
}

// --- items ---

/** New items start as "Not packed" in planning mode and "Plan to pack" in packing mode, so they stay visible. */
export function addItem(list: PackingList, categoryId: string, name: string): PackingList {
  const item: Item = { id: newId(), name, status: list.mode === 'packing' ? 'planned' : 'not_packed', updatedAt: now() };
  return mapCategory(list, categoryId, (c) => ({ ...c, items: [...c.items, item] }));
}

export function renameItem(list: PackingList, itemId: string, name: string): PackingList {
  return mapItems(list, (i) => (i.id === itemId ? { ...i, name, updatedAt: now() } : i));
}

export function deleteItem(list: PackingList, itemId: string): PackingList {
  return mapItems(list, (i) => (i.id === itemId ? { ...i, deleted: true, updatedAt: now() } : i));
}

export function deleteItems(list: PackingList, itemIds: string[]): PackingList {
  const ids = new Set(itemIds);
  return mapItems(list, (i) => (ids.has(i.id) ? { ...i, deleted: true, updatedAt: now() } : i));
}

export function setItemStatus(list: PackingList, itemId: string, status: Status): PackingList {
  return mapItems(list, (i) => (i.id === itemId && i.status !== status ? { ...i, status, updatedAt: now() } : i));
}

/** Change an item's status only if it differs, so untouched items keep their timestamp. */
const withStatus = (i: Item, status: Status): Item => (i.status === status ? i : { ...i, status, updatedAt: now() });

// --- resets ---

/** Everything that is packed goes back to "Plan to pack". Other states are untouched. */
export function unpackAll(list: PackingList): PackingList {
  return mapItems(list, (i) => (i.status === 'packed' ? withStatus(i, 'planned') : i));
}

/**
 * Start planning a new trip. Everything goes back to "Not packed", except:
 *  - items in an "always pack" category go to "Plan to pack"
 *  - items that need a refill stay that way, so they are not forgotten
 */
export function startNewTrip(list: PackingList): PackingList {
  return mapItems(list, (i, c) => {
    if (i.status === 'needs_refill') return i;
    return withStatus(i, c.alwaysPack ? 'planned' : 'not_packed');
  });
}

// --- helpers ---

export function countStatuses(category: Category): { packed: number; active: number } {
  let packed = 0;
  let active = 0;
  for (const i of live(category.items)) {
    if (i.status !== 'not_packed') active++;
    if (i.status === 'packed') packed++;
  }
  return { packed, active };
}

/** Stable id for seed data: "seed-always-pack", "seed-always-pack-phone-charger". */
export const seedId = (...parts: string[]) =>
  ['seed', ...parts].map((p) => p.toLowerCase().replace(/[^a-z0-9]+/g, '-')).join('-');

/**
 * Starter data for a fresh install so the app is not empty on first open.
 * Ids are deterministic and timestamps are 0, so when several devices each start from the seed
 * and then sync, they merge into one set and the server's real data always wins over the seed.
 */
export function seedList(): PackingList {
  const mk = (name: string, alwaysPack: boolean, items: string[]): Category => ({
    id: seedId(name),
    name,
    alwaysPack,
    collapsed: false,
    updatedAt: 0,
    items: items.map((n) => ({ id: seedId(name, n), name: n, status: alwaysPack ? 'planned' : 'not_packed', updatedAt: 0 })),
  });
  return {
    mode: 'planning',
    categories: [
      mk('Always pack', true, ['Phone charger', 'Wallet', 'Keys', 'Toothbrush']),
      mk('Clothes', false, ['T-shirts', 'Pants', 'Socks', 'Underwear', 'Jacket']),
      mk('Toiletries', false, ['Toothpaste', 'Deodorant', 'Shampoo', 'Razor']),
      mk('Electronics', false, ['Laptop', 'Headphones', 'Power bank']),
    ],
  };
}
