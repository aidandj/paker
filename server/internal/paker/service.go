package paker

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"log"
	"sync"
	"time"

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
	// Heartbeat interval for WatchList; keeps proxies from closing idle streams. Zero means the default.
	Heartbeat time.Duration

	mu       sync.Mutex // one list, one writer at a time
	watchers map[chan string]struct{}
}

const defaultHeartbeat = 25 * time.Second

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
	v := Version(merged)
	if v != Version(base) {
		s.notify(v)
	}
	return &pakerv1.SyncListResponse{List: merged, Version: v}, nil
}

// WatchList streams the list version: once on connect, after every change, and as a heartbeat.
func (s *Service) WatchList(_ *pakerv1.WatchListRequest, stream pakerv1.PakerService_WatchListServer) error {
	ch := make(chan string, 1)
	s.mu.Lock()
	if s.watchers == nil {
		s.watchers = map[chan string]struct{}{}
	}
	s.watchers[ch] = struct{}{}
	list, err := s.Store.Load()
	s.mu.Unlock()
	if err != nil {
		s.unwatch(ch)
		return internal("load", err)
	}
	defer s.unwatch(ch)

	hb := s.Heartbeat
	if hb == 0 {
		hb = defaultHeartbeat
	}
	ticker := time.NewTicker(hb)
	defer ticker.Stop()

	current := Version(list)
	if err := stream.Send(&pakerv1.WatchListResponse{Version: current}); err != nil {
		return err
	}
	for {
		select {
		case <-stream.Context().Done():
			return nil
		case v := <-ch:
			current = v
		case <-ticker.C:
		}
		if err := stream.Send(&pakerv1.WatchListResponse{Version: current}); err != nil {
			return err
		}
	}
}

// notify is called with s.mu held. A watcher that has not consumed its previous value just keeps
// the newer one (the channel has room for one; the version is all that matters).
func (s *Service) notify(v string) {
	for ch := range s.watchers {
		select {
		case <-ch:
		default:
		}
		ch <- v
	}
}

func (s *Service) unwatch(ch chan string) {
	s.mu.Lock()
	delete(s.watchers, ch)
	s.mu.Unlock()
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
