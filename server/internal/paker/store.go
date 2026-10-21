package paker

import (
	"errors"
	"os"
	"path/filepath"

	"google.golang.org/protobuf/encoding/protojson"

	pakerv1 "paker/server/gen/paker/v1"
)

// Store persists the single list. Swap FileStore for an S3 or DynamoDB implementation on Lambda.
type Store interface {
	Load() (*pakerv1.PackingList, error)
	Save(*pakerv1.PackingList) error
}

// FileStore keeps the list in one JSON file (protojson). Writes are atomic: temp file + rename.
type FileStore struct{ Path string }

func (f FileStore) Load() (*pakerv1.PackingList, error) {
	data, err := os.ReadFile(f.Path)
	if errors.Is(err, os.ErrNotExist) {
		return &pakerv1.PackingList{}, nil
	}
	if err != nil {
		return nil, err
	}
	var list pakerv1.PackingList
	if err := protojson.Unmarshal(data, &list); err != nil {
		return nil, err
	}
	return &list, nil
}

func (f FileStore) Save(list *pakerv1.PackingList) error {
	if err := os.MkdirAll(filepath.Dir(f.Path), 0o755); err != nil {
		return err
	}
	data, err := protojson.Marshal(list)
	if err != nil {
		return err
	}
	tmp := f.Path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, f.Path)
}
