package paker

import (
	"context"
	"net"
	"net/http"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	pakerv1 "paker/server/gen/paker/v1"
)

// NewGateway returns the JSON/SSE HTTP handler for the service, plus the gRPC server behind it
// (so main can also expose it on a TCP port). The gateway talks to the gRPC server over an
// in-memory connection: grpc-gateway's in-process mode cannot serve streaming methods.
func NewGateway(ctx context.Context, svc *Service, opts ...grpc.ServerOption) (*runtime.ServeMux, *grpc.Server, error) {
	grpcServer := grpc.NewServer(opts...)
	pakerv1.RegisterPakerServiceServer(grpcServer, svc)

	lis := bufconn.Listen(1 << 20)
	go func() { _ = grpcServer.Serve(lis) }()
	conn, err := grpc.NewClient("passthrough:///bufconn",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return lis.Dial() }),
	)
	if err != nil {
		return nil, nil, err
	}

	jsonpb := &runtime.JSONPb{
		MarshalOptions:   protojson.MarshalOptions{EmitUnpopulated: true},
		UnmarshalOptions: protojson.UnmarshalOptions{DiscardUnknown: true}, // newer apps against an older server
	}
	mux := runtime.NewServeMux(
		runtime.WithMarshalerOption(runtime.MIMEWildcard, jsonpb),
		// WatchList as Server-Sent Events for clients that ask for it.
		runtime.WithMarshalerOption("text/event-stream", SSEMarshaler{Marshaler: jsonpb}),
		// The stream must not be buffered by nginx (SWAG) in front of us; this runs before the content
		// type is known, and the headers are harmless on the small JSON responses, so set them always.
		runtime.WithForwardResponseOption(func(_ context.Context, w http.ResponseWriter, _ proto.Message) error {
			w.Header().Set("X-Accel-Buffering", "no")
			w.Header().Set("Cache-Control", "no-cache")
			return nil
		}),
	)
	if err := pakerv1.RegisterPakerServiceHandler(ctx, mux, conn); err != nil {
		return nil, nil, err
	}
	return mux, grpcServer, nil
}
