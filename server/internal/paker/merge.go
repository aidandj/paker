// Package paker implements the PakerService: merge rule, storage and auth.
package paker

import pakerv1 "paker/server/gen/paker/v1"

// Merge combines the stored list with one sent by a device.
//
// Entities are matched by id. For each, the version with the newer updatedAt wins (ties keep the
// stored one). Items are merged per category the same way. Deleted entities are tombstones and
// merge like any other change, so a delete beats an older edit and an older client cannot
// resurrect it. Order is the stored order, with unseen entities appended in the device's order.
func Merge(base, incoming *pakerv1.PackingList) *pakerv1.PackingList {
	out := &pakerv1.PackingList{Categories: []*pakerv1.Category{}}
	byID := map[string]int{}
	for _, c := range base.GetCategories() {
		byID[c.GetId()] = len(out.Categories)
		out.Categories = append(out.Categories, c)
	}
	for _, in := range incoming.GetCategories() {
		idx, seen := byID[in.GetId()]
		if !seen {
			byID[in.GetId()] = len(out.Categories)
			out.Categories = append(out.Categories, in)
			continue
		}
		out.Categories[idx] = mergeCategory(out.Categories[idx], in)
	}
	for _, c := range out.Categories {
		if c.Items == nil {
			c.Items = []*pakerv1.Item{}
		}
	}
	return out
}

func mergeCategory(base, in *pakerv1.Category) *pakerv1.Category {
	merged := &pakerv1.Category{
		Id: base.GetId(), Name: base.GetName(), AlwaysPack: base.GetAlwaysPack(),
		UpdatedAt: base.GetUpdatedAt(), Deleted: base.GetDeleted(),
	}
	if in.GetUpdatedAt() > base.GetUpdatedAt() {
		merged.Name, merged.AlwaysPack, merged.UpdatedAt, merged.Deleted =
			in.GetName(), in.GetAlwaysPack(), in.GetUpdatedAt(), in.GetDeleted()
	}
	merged.Items = mergeItems(base.GetItems(), in.GetItems())
	return merged
}

func mergeItems(base, in []*pakerv1.Item) []*pakerv1.Item {
	out := make([]*pakerv1.Item, 0, len(base))
	byID := map[string]int{}
	for _, it := range base {
		byID[it.GetId()] = len(out)
		out = append(out, it)
	}
	for _, it := range in {
		idx, seen := byID[it.GetId()]
		if !seen {
			byID[it.GetId()] = len(out)
			out = append(out, it)
			continue
		}
		if it.GetUpdatedAt() > out[idx].GetUpdatedAt() {
			out[idx] = it
		}
	}
	return out
}
