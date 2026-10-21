package paker

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"

	pakerv1 "paker/server/gen/paker/v1"
)

func newHTTP(t *testing.T) http.Handler {
	t.Helper()
	svc := &Service{Store: FileStore{Path: filepath.Join(t.TempDir(), "paker.json")}}
	mux := runtime.NewServeMux()
	if err := pakerv1.RegisterPakerServiceHandlerServer(context.Background(), mux, svc); err != nil {
		t.Fatal(err)
	}
	return BasicAuth{User: "u", Password: "p"}.Middleware(mux)
}

func call(h http.Handler, method, path, body string, auth bool) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if auth {
		req.SetBasicAuth("u", "p")
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestAuth(t *testing.T) {
	h := newHTTP(t)
	if rec := call(h, "GET", "/api/v1/list", "", false); rec.Code != 401 {
		t.Fatalf("want 401, got %d", rec.Code)
	}
	req := httptest.NewRequest("GET", "/api/v1/list", nil)
	req.SetBasicAuth("u", "wrong")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 401 {
		t.Fatalf("wrong password: want 401, got %d", rec.Code)
	}
}

func TestJSONRoundTrip(t *testing.T) {
	h := newHTTP(t)
	rec := call(h, "GET", "/api/v1/list", "", true)
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"categories":[]`) {
		t.Fatalf("empty get: %d %s", rec.Code, rec.Body.String())
	}

	// Device A pushes a list.
	a := `{"list":{"categories":[{"id":"c","name":"Clothes","updatedAt":"1","items":[{"id":"x","name":"x","status":"STATUS_PLANNED","updatedAt":"1"}]}]}}`
	if rec = call(h, "POST", "/api/v1/list:sync", a, true); rec.Code != 200 {
		t.Fatalf("post: %d %s", rec.Code, rec.Body.String())
	}

	// Device B, never synced, changes the same item and adds one; it gets the merge back.
	b := `{"list":{"categories":[{"id":"c","name":"Clothes","updatedAt":"1","items":[{"id":"x","name":"x","status":"STATUS_PACKED","updatedAt":"2"},{"id":"y","name":"y","status":"STATUS_PLANNED","updatedAt":"2"}]}]}}`
	rec = call(h, "POST", "/api/v1/list:sync", b, true)
	body := rec.Body.String()
	if rec.Code != 200 || !strings.Contains(body, `"id":"y"`) || !strings.Contains(body, `"status":"STATUS_PACKED"`) {
		t.Fatalf("merge: %d %s", rec.Code, body)
	}

	// Persisted.
	rec = call(h, "GET", "/api/v1/list", "", true)
	if !strings.Contains(rec.Body.String(), `"id":"y"`) {
		t.Fatalf("not persisted: %s", rec.Body.String())
	}
}

func TestBadJSON(t *testing.T) {
	h := newHTTP(t)
	if rec := call(h, "POST", "/api/v1/list:sync", "{not json", true); rec.Code != 400 {
		t.Fatalf("want 400, got %d %s", rec.Code, rec.Body.String())
	}
}
