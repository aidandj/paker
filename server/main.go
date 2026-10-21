// Paker server: serves the web app at /, the JSON API at /api/ (grpc-gateway) and gRPC on its own port.
//
// Environment:
//
//	SYNC_USER, SYNC_PASSWORD  required, the single account
//	DATA_FILE                 where the list is stored (default /data/paker.json)
//	WEB_DIR                   built web app to serve at / (default /web)
//	PORT                      HTTP port (default 8080)
//	GRPC_PORT                 gRPC port (default 9090, empty disables)
//
// To run on AWS Lambda instead, wrap the same http.Handler with an adapter such as
// github.com/akrylysov/algnhsa and give Service a Store backed by S3.
package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/encoding/protojson"

	pakerv1 "paker/server/gen/paker/v1"
	"paker/server/internal/paker"
)

func main() {
	auth := paker.BasicAuth{User: os.Getenv("SYNC_USER"), Password: os.Getenv("SYNC_PASSWORD")}
	if auth.User == "" || auth.Password == "" {
		log.Fatal("SYNC_USER and SYNC_PASSWORD must be set")
	}
	svc := &paker.Service{Store: paker.FileStore{Path: envOr("DATA_FILE", "/data/paker.json")}}

	// gRPC
	if port := envOr("GRPC_PORT", "9090"); port != "" {
		grpcServer := grpc.NewServer(grpc.UnaryInterceptor(auth.Interceptor))
		pakerv1.RegisterPakerServiceServer(grpcServer, svc)
		lis, err := net.Listen("tcp", ":"+port)
		if err != nil {
			log.Fatal(err)
		}
		go func() { log.Fatal(grpcServer.Serve(lis)) }()
		log.Printf("gRPC on :%s", port)
	}

	// HTTP: JSON API via grpc-gateway (calls the service directly, no loopback), plus the web app.
	gw := runtime.NewServeMux(runtime.WithMarshalerOption(runtime.MIMEWildcard, &runtime.JSONPb{
		MarshalOptions: protojson.MarshalOptions{EmitUnpopulated: true},
	}))
	if err := pakerv1.RegisterPakerServiceHandlerServer(context.Background(), gw, svc); err != nil {
		log.Fatal(err)
	}
	root := http.NewServeMux()
	root.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })
	root.Handle("/api/", auth.Middleware(gw))
	root.Handle("/", spa(envOr("WEB_DIR", "/web")))

	port := envOr("PORT", "8080")
	log.Printf("HTTP on :%s (web app at /, API at /api/)", port)
	log.Fatal((&http.Server{Addr: ":" + port, Handler: logRequests(root), ReadHeaderTimeout: 5 * time.Second}).ListenAndServe())
}

// spa serves a single-page web build: real files as-is, everything else falls back to index.html.
func spa(dir string) http.Handler {
	files := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := os.Stat(filepath.Join(dir, "index.html")); err != nil {
			http.Error(w, "web app not built (WEB_DIR="+dir+")", http.StatusNotFound)
			return
		}
		if _, err := os.Stat(filepath.Join(dir, filepath.Clean(r.URL.Path))); err != nil {
			r.URL.Path = "/"
		}
		files.ServeHTTP(w, r)
	})
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}
