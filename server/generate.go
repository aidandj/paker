package main

// Regenerates server/gen and src/gen from proto/. buf is a Go tool dependency (see go.mod), so
// `go generate ./...` in this directory is all that is needed. Plugins run remotely on the Buf registry.
//go:generate go tool buf generate --template ../buf.gen.yaml ..
