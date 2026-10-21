package paker

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"log"
	"sync"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	pakerv1 "paker/server/gen/paker/v1"
)

// Service implements pakerv1.PakerServiceServer. It is served over gRPC and, through
// grpc-gateway, as JSON under /api/.
type Service struct {
	pakerv1.UnimplementedPakerServiceServer
	Store Store

	mu sync.Mutex // one list, one writer at a time
}

func (s *Service) GetList(ctx context.Context, _ *pakerv1.GetListRequest) (*pakerv1.GetListResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	list, err := s.Store.Load()
	if err != nil {
		return nil, internal("load", err)
	}
	return &pakerv1.GetListResponse{List: Merge(list, nil)}, nil
}

func (s *Service) GetListVersion(ctx context.Context, _ *pakerv1.GetListVersionRequest) (*pakerv1.GetListVersionResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	list, err := s.Store.Load()
	if err != nil {
		return nil, internal("load", err)
	}
	return &pakerv1.GetListVersionResponse{Version: Version(list)}, nil
}

func (s *Service) SyncList(ctx context.Context, req *pakerv1.SyncListRequest) (*pakerv1.SyncListResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	base, err := s.Store.Load()
	if err != nil {
		return nil, internal("load", err)
	}
	merged := Merge(base, req.GetList())
	if err := s.Store.Save(merged); err != nil {
		return nil, internal("save", err)
	}
	return &pakerv1.SyncListResponse{List: merged, Version: Version(merged)}, nil
}

// Version is a content hash of the list: same list, same version, on every server.
func Version(list *pakerv1.PackingList) string {
	b, err := proto.MarshalOptions{Deterministic: true}.Marshal(list)
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:8])
}

func internal(what string, err error) error {
	log.Printf("%s failed: %v", what, err)
	return status.Error(codes.Internal, "storage error")
}
