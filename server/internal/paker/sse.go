package paker

import (
	"bytes"
	"io"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
)

// SSEMarshaler renders grpc-gateway server streams as Server-Sent Events: each message becomes a
// "data: <json>" line and events are separated by a blank line. Register it for the
// "text/event-stream" Accept value; unary responses still use the wrapped JSON marshaler.
type SSEMarshaler struct{ runtime.Marshaler }

func (m SSEMarshaler) Marshal(v any) ([]byte, error) {
	b, err := m.Marshaler.Marshal(v)
	if err != nil {
		return nil, err
	}
	var out bytes.Buffer
	for _, line := range bytes.Split(bytes.TrimRight(b, "\n"), []byte("\n")) {
		out.WriteString("data: ")
		out.Write(line)
		out.WriteByte('\n')
	}
	return out.Bytes(), nil
}

func (m SSEMarshaler) NewEncoder(w io.Writer) runtime.Encoder {
	return runtime.EncoderFunc(func(v any) error {
		b, err := m.Marshal(v)
		if err != nil {
			return err
		}
		_, err = w.Write(b)
		return err
	})
}

// Delimiter ends each event; together with Marshal's trailing newline this is the SSE blank line.
func (SSEMarshaler) Delimiter() []byte { return []byte("\n") }

func (SSEMarshaler) StreamContentType(any) string { return "text/event-stream" }
