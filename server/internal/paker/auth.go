package paker

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"net/http"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// BasicAuth is the single user/password account. The same check guards HTTP and gRPC.
type BasicAuth struct{ User, Password string }

// Valid reports whether an "Authorization: Basic ..." header value matches.
func (a BasicAuth) Valid(header string) bool {
	raw, ok := strings.CutPrefix(header, "Basic ")
	if !ok {
		return false
	}
	decoded, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return false
	}
	user, pass, ok := strings.Cut(string(decoded), ":")
	if !ok {
		return false
	}
	userOK := subtle.ConstantTimeCompare([]byte(user), []byte(a.User)) == 1
	passOK := subtle.ConstantTimeCompare([]byte(pass), []byte(a.Password)) == 1
	return userOK && passOK
}

// Middleware protects an HTTP handler.
func (a BasicAuth) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !a.Valid(r.Header.Get("Authorization")) {
			w.Header().Set("WWW-Authenticate", `Basic realm="paker"`)
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Interceptor protects the gRPC port using the same header in metadata.
func (a BasicAuth) Interceptor(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	md, _ := metadata.FromIncomingContext(ctx)
	for _, v := range md.Get("authorization") {
		if a.Valid(v) {
			return handler(ctx, req)
		}
	}
	return nil, status.Error(codes.Unauthenticated, "unauthorized")
}
