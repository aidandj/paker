package paker

import (
	"context"
	"log"
	"sync"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

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
	return &pakerv1.SyncListResponse{List: merged}, nil
}

func internal(what string, err error) error {
	log.Printf("%s failed: %v", what, err)
	return status.Error(codes.Internal, "storage error")
}
