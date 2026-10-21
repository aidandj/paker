package paker

import (
	"testing"

	pakerv1 "paker/server/gen/paker/v1"
)

func item(id string, status pakerv1.Status, at int64) *pakerv1.Item {
	return &pakerv1.Item{Id: id, Name: id, Status: status, UpdatedAt: at}
}

func cat(id string, at int64, items ...*pakerv1.Item) *pakerv1.Category {
	return &pakerv1.Category{Id: id, Name: id, UpdatedAt: at, Items: items}
}

func list(cs ...*pakerv1.Category) *pakerv1.PackingList { return &pakerv1.PackingList{Categories: cs} }

func ids(items []*pakerv1.Item) []string {
	var out []string
	for _, it := range items {
		out = append(out, it.GetId())
	}
	return out
}

func equal(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestNewerWinsPerItem(t *testing.T) {
	base := list(cat("c", 1, item("a", pakerv1.Status_STATUS_PLANNED, 5), item("b", pakerv1.Status_STATUS_PLANNED, 5)))
	in := list(cat("c", 1, item("a", pakerv1.Status_STATUS_PACKED, 9), item("b", pakerv1.Status_STATUS_PACKED, 3)))
	got := Merge(base, in).Categories[0].Items
	if got[0].Status != pakerv1.Status_STATUS_PACKED || got[1].Status != pakerv1.Status_STATUS_PLANNED {
		t.Fatalf("got %v", got)
	}
}

func TestTieKeepsStored(t *testing.T) {
	base := list(cat("c", 1, item("a", pakerv1.Status_STATUS_PLANNED, 5)))
	in := list(cat("c", 1, item("a", pakerv1.Status_STATUS_PACKED, 5)))
	if got := Merge(base, in).Categories[0].Items[0].Status; got != pakerv1.Status_STATUS_PLANNED {
		t.Fatalf("tie should keep stored, got %v", got)
	}
}

func TestAppendsUnseenInOrder(t *testing.T) {
	base := list(cat("c1", 1, item("a", 1, 1)))
	in := list(cat("c2", 1), cat("c1", 1, item("b", 1, 1), item("a", 1, 1), item("c", 1, 1)))
	got := Merge(base, in)
	if got.Categories[0].Id != "c1" || got.Categories[1].Id != "c2" {
		t.Fatalf("category order %v", got.Categories)
	}
	if !equal(ids(got.Categories[0].Items), []string{"a", "b", "c"}) {
		t.Fatalf("item order %v", ids(got.Categories[0].Items))
	}
	if got.Categories[1].Items == nil {
		t.Fatal("items must be non-nil")
	}
}

func TestTombstonesAndCategoryFields(t *testing.T) {
	base := list(&pakerv1.Category{Id: "c", Name: "Old", UpdatedAt: 1, Items: []*pakerv1.Item{item("a", 1, 1)}})
	in := list(&pakerv1.Category{Id: "c", Name: "New", AlwaysPack: true, UpdatedAt: 2, Items: []*pakerv1.Item{
		{Id: "a", Name: "a", UpdatedAt: 2, Deleted: true},
	}})
	got := Merge(base, in).Categories[0]
	if got.Name != "New" || !got.AlwaysPack || !got.Items[0].Deleted {
		t.Fatalf("got %v", got)
	}
	// An older client that never saw the delete cannot resurrect it.
	stale := list(&pakerv1.Category{Id: "c", Name: "Older", UpdatedAt: 0, Items: []*pakerv1.Item{item("a", pakerv1.Status_STATUS_PACKED, 1)}})
	again := Merge(Merge(base, in), stale).Categories[0]
	if again.Name != "New" || !again.Items[0].Deleted {
		t.Fatalf("stale client resurrected: %v", again)
	}
}

func TestTripsMergeNewestWins(t *testing.T) {
	base := &pakerv1.PackingList{Trips: []*pakerv1.SavedTrip{{Id: "t", Name: "Old", UpdatedAt: 1, Items: []*pakerv1.ItemState{{ItemId: "a", Status: pakerv1.Status_STATUS_PLANNED}}}}}
	in := &pakerv1.PackingList{Trips: []*pakerv1.SavedTrip{
		{Id: "t", Name: "New", UpdatedAt: 2, Items: []*pakerv1.ItemState{{ItemId: "a", Status: pakerv1.Status_STATUS_PACKED}}},
		{Id: "u", Name: "Other", UpdatedAt: 1},
	}}
	got := Merge(base, in).Trips
	if len(got) != 2 || got[0].Name != "New" || got[0].Items[0].Status != pakerv1.Status_STATUS_PACKED || got[1].Items == nil {
		t.Fatalf("got %v", got)
	}
	stale := &pakerv1.PackingList{Trips: []*pakerv1.SavedTrip{{Id: "t", Name: "Older", UpdatedAt: 0}}}
	if again := Merge(Merge(base, in), stale).Trips[0]; again.Name != "New" {
		t.Fatalf("stale overwrote: %v", again)
	}
	del := &pakerv1.PackingList{Trips: []*pakerv1.SavedTrip{{Id: "t", Name: "New", UpdatedAt: 3, Deleted: true, Items: []*pakerv1.ItemState{{ItemId: "a"}}}}}
	if gone := Merge(Merge(base, in), del).Trips[0]; !gone.Deleted || len(gone.Items) != 0 {
		t.Fatalf("deleted trip should be an empty tombstone: %v", gone)
	}
}

func TestNilInputs(t *testing.T) {
	got := Merge(nil, nil)
	if got == nil || got.Categories == nil || len(got.Categories) != 0 {
		t.Fatalf("got %v", got)
	}
}
