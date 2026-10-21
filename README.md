# Paker

A simple packing list for trips. Android and iOS, built with Expo / React Native.

## How it works

Items live in collapsible categories. Each item has one of four color-coded states:

| State | Color | Meaning |
| --- | --- | --- |
| Not packed | gray | Not going on this trip |
| Plan to pack | blue | Going on this trip, not in the bag yet |
| Packed | green | In the bag |
| Needs refill | orange | Ran out during the trip, restock before next time |

The app has two modes, switched at the top:

- **Planning**: all items are shown. Tapping an item toggles Not packed <-> Plan to pack.
- **Packing**: only items on the trip are shown (Not packed items and empty categories are hidden).
  Tapping an item toggles Plan to pack <-> Packed. Items added here start as Plan to pack.

Tap an item's status pill to open all four state buttons (including Needs refill) plus Rename / Delete.
Tap a category header to collapse it, `+` to add an item, `⋯` for Rename / Always pack / Delete.

**Reset** (top right) offers two actions:

- **Unpack all**: Packed → Plan to pack. Use when you unpack and want to keep the same plan.
- **New trip**: everything → Not packed, except items in an *always pack* category, which go to Plan to pack.

Items marked Needs refill are kept through both resets so they are not forgotten.

Data is saved on the device. Optionally it syncs through a small self-hosted server (below).

## Sync

Tap **Sync** in the top bar and enter the server URL, username and password. From then on every
change is sent to the server (debounced), and the app also syncs on launch and when it returns to
the foreground. The dot next to Sync shows the state: gray off, blue syncing, green synced, red error.

How it works: the app sends its whole list; the server merges it with the stored list and returns
the result, which the app adopts. Every item and category carries `updatedAt`, and the newer version
wins per entity, so two phones can edit different items at once without losing anything. Deletes are
tombstones (`deleted: true`, hidden in the UI) so they reach every device. Mode and collapsed state
are per device and never synced.

The API is defined in [proto/paker/v1/paker.proto](proto/paker/v1/paker.proto) (gRPC with
`google.api.http` annotations). The Go server serves it as gRPC and, through grpc-gateway, as JSON:

```
GET  /api/v1/list        current list
POST /api/v1/list:sync   body {"list": {...}} -> merged list
GET  /api/health         "ok", no auth
```

Auth is HTTP Basic with the single account from `.env`. The web build of the app is served at `/`.

### Run the server

```sh
cp .env.example .env     # set SYNC_USER / SYNC_PASSWORD
docker compose up -d     # builds the web app and the Go server; data lives in the paker-data volume
```

Put it behind your reverse proxy with TLS. Then open `https://your-host/` in a browser for the web
app, or point the phone app at that URL.

A multi-arch image (amd64, arm64) is published at `ghcr.io/aidandj/paker:latest`; the compose file
pulls it, so hosts never need to build. Publish a new one from this directory with:

```sh
docker buildx build --platform linux/amd64,linux/arm64 -f server/Dockerfile -t ghcr.io/aidandj/paker:latest --push .
```

[deploy/nas/](deploy/nas/) holds the Synology/SWAG setup actually used for paker.aidandj.com:
`deploy.sh` copies the compose file to the NAS, creates `.env`, pulls and starts the container,
installs the SWAG proxy conf and reloads nginx.

Without Docker: `cd server && SYNC_USER=me SYNC_PASSWORD=x DATA_FILE=./paker.json WEB_DIR=../dist go run .`
(`npx expo export --platform web` produces `dist/`).

Moving to a cloud function later: `internal/paker.Service` is plain gRPC, the HTTP side is one
`http.Handler`, and storage is a two-method `Store` interface. Wrap the handler with a Lambda adapter
and give `Service` an S3-backed `Store`.

## Layout

```
App.tsx                      screen: loads/saves the list, wires callbacks
src/types.ts                 data types, state labels and colors
src/model.ts                 pure functions that change the list (tested)
src/model.test.ts            tests for model.ts
src/storage.ts               local load/save
src/api.ts                   app types <-> proto messages, one fetch call to the server
src/sync.ts                  when to sync (debounce, launch, foreground) and the status
src/gen/                     generated from proto (protobuf-es), do not edit
src/components/              CategorySection, ItemRow, NameModal, SettingsModal
proto/paker/v1/paker.proto   the API
server/main.go               Go server: gRPC + JSON gateway + static web app
server/internal/paker/       merge rule, file store, service, basic auth (tested)
server/gen/                  generated from proto (protoc-gen-go, grpc, grpc-gateway), do not edit
server/Dockerfile, docker-compose.yml, .env.example
```

## Develop

```sh
npm install
npx expo start          # then press a (Android emulator) or i (iOS simulator)
npm test                # model tests (Node's built-in test runner, no extra deps)
npm run test:server     # Go tests
npm run typecheck
cd server && go generate ./...   # regenerate server/gen and src/gen after editing the .proto
```

`buf` is a Go tool dependency of the server module, so `go generate` is all that is needed; the
plugins run on the Buf registry. Generated code is committed.
Runs in Expo Go. For a standalone build use `npx expo run:android` / `npx expo run:ios` or EAS.
