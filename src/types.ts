export type Status = 'not_packed' | 'planned' | 'packed' | 'needs_refill';

export const STATUSES: Status[] = ['not_packed', 'planned', 'packed', 'needs_refill'];

export const STATUS_LABEL: Record<Status, string> = {
  not_packed: 'Not packed',
  planned: 'Plan to pack',
  packed: 'Packed',
  needs_refill: 'Needs refill',
};

export const STATUS_COLOR: Record<Status, string> = {
  not_packed: '#9E9E9E',
  planned: '#2F80ED',
  packed: '#27AE60',
  needs_refill: '#F2994A',
};

/**
 * Sync fields, present on items and categories:
 *  - updatedAt: Unix ms of the last change to this entity's own fields. The server keeps the newer
 *    version of each entity when two devices disagree.
 *  - deleted: a tombstone. Deleted entities stay in the list (hidden) so the delete reaches other devices.
 */
export interface Item {
  id: string;
  name: string;
  status: Status;
  updatedAt: number;
  deleted?: boolean;
  /** Present only for counted items: needed is how many to bring (0 = not on this trip), packed how many are in the bag. */
  quantity?: Quantity;
}

export interface Quantity {
  needed: number;
  packed: number;
}

export interface Category {
  id: string;
  name: string;
  /** Items in this category go to "Plan to pack" (not "Not packed") when a new trip starts. */
  alwaysPack: boolean;
  /** View state, per device, not synced. */
  collapsed: boolean;
  updatedAt: number;
  deleted?: boolean;
  items: Item[];
}

/**
 * Planning: decide what goes on the trip. Tap toggles Not packed <-> Plan to pack.
 * Packing:  put things in the bag. Tap toggles Plan to pack <-> Packed. Not-packed items are hidden.
 */
export type Mode = 'planning' | 'packing';

export interface PackingList {
  mode: Mode;
  categories: Category[];
}
