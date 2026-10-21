package paker

import (
	"bufio"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"google.golang.org/grpc"
)

func newHTTP(t *testing.T) http.Handler {
	t.Helper()
	svc := &Service{Store: FileStore{Path: filepath.Join(t.TempDir(), "paker.json")}, Heartbeat: 200 * time.Millisecond}
	auth := BasicAuth{User: "u", Password: "p"}
	mux, grpcServer, err := NewGateway(context.Background(), svc, grpc.UnaryInterceptor(auth.Interceptor), grpc.StreamInterceptor(auth.StreamInterceptor))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(grpcServer.Stop)
	return auth.Middleware(mux)
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

func TestVersionChangesWithContent(t *testing.T) {
	h := newHTTP(t)
	v0 := call(h, "GET", "/api/v1/list:version", "", true).Body.String()
	call(h, "POST", "/api/v1/list:sync", `{"list":{"categories":[{"id":"c","name":"C","updatedAt":"1","items":[]}]}}`, true)
	v1 := call(h, "GET", "/api/v1/list:version", "", true).Body.String()
	v1again := call(h, "GET", "/api/v1/list:version", "", true).Body.String()
	if v0 == v1 || v1 != v1again || !strings.Contains(v1, `"version":"`) {
		t.Fatalf("v0=%s v1=%s again=%s", v0, v1, v1again)
	}
	if !strings.Contains(call(h, "POST", "/api/v1/list:sync", `{"list":{}}`, true).Body.String(), `"version":"`) {
		t.Fatal("sync response should carry the version")
	}
}

func TestWatchListAsSSE(t *testing.T) {
	h := newHTTP(t)
	srv := httptest.NewServer(h)
	defer srv.Close()

	req, _ := http.NewRequest("GET", srv.URL+"/api/v1/list:watch", nil)
	req.SetBasicAuth("u", "p")
	req.Header.Set("Accept", "text/event-stream")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if ct := res.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Fatalf("content type %q", ct)
	}
	events := make(chan string, 10)
	go func() {
		r := bufio.NewReader(res.Body)
		for {
			line, err := r.ReadString('\n')
			if strings.HasPrefix(line, "data: ") {
				events <- strings.TrimSpace(strings.TrimPrefix(line, "data: "))
			}
			if err == io.EOF || err != nil {
				return
			}
		}
	}()
	next := func() string {
		select {
		case e := <-events:
			return e
		case <-time.After(2 * time.Second):
			t.Fatal("no event")
			return ""
		}
	}
	first := next()
	if !strings.Contains(first, `"version":"`) {
		t.Fatalf("first event %q", first)
	}
	// A change on another client produces an event with a new version.
	call(h, "POST", "/api/v1/list:sync", `{"list":{"categories":[{"id":"c","name":"C","updatedAt":"1","items":[]}]}}`, true)
	deadline := time.After(2 * time.Second)
	for {
		select {
		case e := <-events:
			if e != first {
				return // changed version arrived (heartbeats may repeat the old one first)
			}
		case <-deadline:
			t.Fatal("no change event")
		}
	}
}

func TestBadJSON(t *testing.T) {
	h := newHTTP(t)
	if rec := call(h, "POST", "/api/v1/list:sync", "{not json", true); rec.Code != 400 {
		t.Fatalf("want 400, got %d %s", rec.Code, rec.Body.String())
	}
}
