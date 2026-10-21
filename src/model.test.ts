// Run with: npm test   (uses Node's built-in test runner, no extra dependencies)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as m from './model.ts';
import type { PackingList, Status } from './types.ts';

function fixture(): PackingList {
  const cat = (id: string, alwaysPack: boolean, items: [string, Status][]) => ({
    id,
    name: id,
    alwaysPack,
    collapsed: false,
    updatedAt: 1,
    items: items.map(([name, status]) => ({ id: `${id}-${name}`, name, status, updatedAt: 1 })),
  });
  return {
    mode: 'planning',
    categories: [
      cat('always', true, [['keys', 'packed'], ['wallet', 'not_packed'], ['meds', 'needs_refill']]),
      cat('clothes', false, [['shirt', 'packed'], ['pants', 'planned'], ['socks', 'not_packed'], ['lotion', 'needs_refill']]),
    ],
  };
}

const statusesOf = (list: PackingList, catId: string) =>
  list.categories.find((c) => c.id === catId)!.items.map((i) => i.status);

test('unpackAll moves packed items to planned and leaves the rest alone', () => {
  const out = m.unpackAll(fixture());
  assert.deepEqual(statusesOf(out, 'always'), ['planned', 'not_packed', 'needs_refill']);
  assert.deepEqual(statusesOf(out, 'clothes'), ['planned', 'planned', 'not_packed', 'needs_refill']);
});

test('startNewTrip clears everything except always-pack (planned) and needs_refill', () => {
  const out = m.startNewTrip(fixture());
  assert.deepEqual(statusesOf(out, 'always'), ['planned', 'planned', 'needs_refill']);
  assert.deepEqual(statusesOf(out, 'clothes'), ['not_packed', 'not_packed', 'not_packed', 'needs_refill']);
});

test('model functions do not mutate their input', () => {
  const input = fixture();
  const snapshot = JSON.stringify(input);
  m.unpackAll(input);
  m.startNewTrip(input);
  m.setItemStatus(input, 'clothes-shirt', 'planned');
  m.deleteItem(input, 'clothes-shirt');
  m.deleteCategory(input, 'clothes');
  assert.equal(JSON.stringify(input), snapshot);
});

test('add, rename, set status, delete item', () => {
  let list = m.addItem(fixture(), 'clothes', 'hat');
  const hat = list.categories[1].items.at(-1)!;
  assert.equal(hat.name, 'hat');
  assert.equal(hat.status, 'not_packed');

  list = m.renameItem(list, hat.id, 'cap');
  list = m.setItemStatus(list, hat.id, 'packed');
  const cap = list.categories[1].items.find((i) => i.id === hat.id)!;
  assert.equal(cap.name, 'cap');
  assert.equal(cap.status, 'packed');

  list = m.deleteItem(list, hat.id);
  const gone = list.categories[1].items.find((i) => i.id === hat.id)!;
  assert.equal(gone.deleted, true);
  assert.equal(m.live(list.categories[1].items).some((i) => i.id === hat.id), false);
});

test('deleteItems tombstones several items at once', () => {
  const list = m.deleteItems(fixture(), ['clothes-shirt', 'clothes-socks']);
  assert.deepEqual(m.live(list.categories[1].items).map((i) => i.name), ['pants', 'lotion']);
});

test('add, rename, toggle, delete category', () => {
  let list = m.addCategory(fixture(), 'Camping');
  const cat = list.categories.at(-1)!;
  assert.equal(cat.name, 'Camping');
  assert.equal(cat.alwaysPack, false);

  list = m.renameCategory(list, cat.id, 'Camp');
  list = m.toggleAlwaysPack(list, cat.id);
  list = m.toggleCollapsed(list, cat.id);
  const updated = list.categories.find((c) => c.id === cat.id)!;
  assert.equal(updated.name, 'Camp');
  assert.equal(updated.alwaysPack, true);
  assert.equal(updated.collapsed, true);

  list = m.deleteCategory(list, cat.id);
  assert.equal(m.live(list.categories).length, 2);
  assert.equal(list.categories.length, 3);
});

test('tap in planning mode toggles whether an item is on the trip', () => {
  assert.equal(m.nextStatusOnTap('not_packed', 'planning'), 'planned');
  assert.equal(m.nextStatusOnTap('planned', 'planning'), 'not_packed');
  assert.equal(m.nextStatusOnTap('packed', 'planning'), 'not_packed');
  assert.equal(m.nextStatusOnTap('needs_refill', 'planning'), 'not_packed');
});

test('tap in packing mode toggles between planned and packed', () => {
  assert.equal(m.nextStatusOnTap('planned', 'packing'), 'packed');
  assert.equal(m.nextStatusOnTap('packed', 'packing'), 'planned');
  assert.equal(m.nextStatusOnTap('needs_refill', 'packing'), 'packed');
});

test('tapItem uses the list mode', () => {
  let list = m.tapItem(fixture(), 'clothes-socks');
  assert.equal(list.categories[1].items[2].status, 'planned');
  list = m.tapItem(m.setMode(list, 'packing'), 'clothes-socks');
  assert.equal(list.categories[1].items[2].status, 'packed');
});

test('packing mode hides not-packed items; new items there start as planned', () => {
  const it = (status: Status) => ({ id: 'x', name: 'x', status, updatedAt: 1 });
  assert.equal(m.isVisible(it('not_packed'), 'packing'), false);
  assert.equal(m.isVisible(it('not_packed'), 'planning'), true);
  assert.equal(m.isVisible(it('planned'), 'packing'), true);
  const list = m.addItem(m.setMode(fixture(), 'packing'), 'clothes', 'hat');
  assert.equal(list.categories[1].items.at(-1)!.status, 'planned');
});

test('quantity items: needed drives planning, packed drives packing, resets zero both', () => {
  let list = m.addItem(fixture(), 'clothes', 'Shirts', true);
  const id = list.categories[1].items.at(-1)!.id;
  const item = (l: PackingList) => l.categories[1].items.find((i) => i.id === id)!;
  assert.deepEqual(item(list).quantity, { needed: 0, packed: 0 });
  assert.equal(item(list).status, 'not_packed');

  list = m.adjustNeeded(list, id, 1);
  list = m.adjustNeeded(list, id, 1);
  list = m.adjustNeeded(list, id, 1);
  assert.deepEqual(item(list).quantity, { needed: 3, packed: 0 });
  assert.equal(item(list).status, 'planned');

  list = m.adjustPacked(list, id, 1);
  assert.deepEqual(item(list).quantity, { needed: 3, packed: 1 });
  assert.equal(item(list).status, 'planned');
  list = m.adjustPacked(list, id, 5); // clamped to needed
  assert.deepEqual(item(list).quantity, { needed: 3, packed: 3 });
  assert.equal(item(list).status, 'packed');

  list = m.adjustNeeded(list, id, 1); // need one more -> no longer fully packed
  assert.equal(item(list).status, 'planned');
  assert.deepEqual(item(list).quantity, { needed: 4, packed: 3 });

  list = m.unpackAll(m.adjustPacked(list, id, 1));
  assert.deepEqual(item(list).quantity, { needed: 4, packed: 0 });

  list = m.startNewTrip(list);
  assert.deepEqual(item(list).quantity, { needed: 0, packed: 0 });
  assert.equal(item(list).status, 'not_packed');

  list = m.adjustNeeded(list, id, -1); // never below 0
  assert.deepEqual(item(list).quantity, { needed: 0, packed: 0 });

  // tapping a counted item behaves like the plain toggle, keeping counts consistent
  list = m.tapItem(list, id); // planning: on
  assert.deepEqual(item(list).quantity, { needed: 1, packed: 0 });
  list = m.tapItem(m.setMode(list, 'packing'), id); // packing: fill
  assert.deepEqual(item(list).quantity, { needed: 1, packed: 1 });
  assert.equal(item(list).status, 'packed');

  list = m.setItemQuantity(list, id, false);
  assert.equal(item(list).quantity, undefined);
});

test('countStatuses counts packed and active (anything but not_packed), ignoring tombstones', () => {
  const { packed, active } = m.countStatuses(fixture().categories[1]);
  assert.equal(packed, 1);
  assert.equal(active, 3);
  const after = m.deleteItem(fixture(), 'clothes-shirt');
  assert.equal(m.countStatuses(after.categories[1]).packed, 0);
});

test('changes bump updatedAt only on the entity that changed', () => {
  const before = fixture();
  const list = m.setItemStatus(before, 'clothes-socks', 'planned');
  const socks = list.categories[1].items[2];
  const shirt = list.categories[1].items[0];
  assert.ok(socks.updatedAt > 1);
  assert.equal(shirt.updatedAt, 1);
  assert.equal(list.categories[1].updatedAt, 1);
  // same status again is a no-op
  const again = m.setItemStatus(list, 'clothes-socks', 'planned');
  assert.equal(again.categories[1].items[2].updatedAt, socks.updatedAt);
});

test('seedList has an always-pack category whose items start as planned', () => {
  const seed = m.seedList();
  const always = seed.categories.find((c) => c.alwaysPack)!;
  assert.ok(always);
  assert.ok(always.items.every((i) => i.status === 'planned'));
});

test('seed ids are deterministic and seed timestamps are 0, so devices merge into one seed', () => {
  const a = m.seedList();
  const b = m.seedList();
  assert.deepEqual(JSON.stringify(a), JSON.stringify(b));
  assert.equal(a.categories[0].id, 'seed-always-pack');
  assert.equal(a.categories[0].items[0].id, 'seed-always-pack-phone-charger');
  assert.ok(a.categories.every((c) => c.updatedAt === 0 && c.items.every((i) => i.updatedAt === 0)));
});
