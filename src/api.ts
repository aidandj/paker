// Talks to the Go server's JSON API (grpc-gateway transcoding of proto/paker/v1/paker.proto).
// Messages are built and parsed with protobuf-es so the JSON matches the gateway exactly.
import { create, fromJson, type JsonValue, toJson } from '@bufbuild/protobuf';
import {
  GetListResponseSchema,
  type PackingList as PbPackingList,
  PackingListSchema,
  Status as PbStatus,
  SyncListRequestSchema,
  SyncListResponseSchema,
} from './gen/paker/v1/paker_pb';
import type { Category, Item, PackingList, Status } from './types';

export interface ServerConfig {
  url: string; // e.g. https://paker.example.com (no trailing slash)
  user: string;
  password: string;
}

const toPbStatus: Record<Status, PbStatus> = {
  not_packed: PbStatus.NOT_PACKED,
  planned: PbStatus.PLANNED,
  packed: PbStatus.PACKED,
  needs_refill: PbStatus.NEEDS_REFILL,
};
const fromPbStatus = (s: PbStatus): Status =>
  (Object.keys(toPbStatus) as Status[]).find((k) => toPbStatus[k] === s) ?? 'not_packed';

export function toProto(list: PackingList): PbPackingList {
  return create(PackingListSchema, {
    categories: list.categories.map((c) => ({
      id: c.id,
      name: c.name,
      alwaysPack: c.alwaysPack,
      updatedAt: BigInt(c.updatedAt),
      deleted: !!c.deleted,
      items: c.items.map((i) => ({
        id: i.id,
        name: i.name,
        status: toPbStatus[i.status],
        updatedAt: BigInt(i.updatedAt),
        deleted: !!i.deleted,
        quantity: i.quantity,
        alwaysPack: !!i.alwaysPack,
      })),
    })),
  });
}

/** Converts a server list back to app state, keeping this device's view state (mode, collapsed). */
export function fromProto(pb: PbPackingList | undefined, local: PackingList): PackingList {
  const collapsed = new Map(local.categories.map((c) => [c.id, c.collapsed]));
  const categories: Category[] = (pb?.categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    alwaysPack: c.alwaysPack,
    collapsed: collapsed.get(c.id) ?? false,
    updatedAt: Number(c.updatedAt),
    deleted: c.deleted || undefined,
    items: c.items.map(
      (i): Item => ({
        id: i.id,
        name: i.name,
        status: fromPbStatus(i.status),
        updatedAt: Number(i.updatedAt),
        deleted: i.deleted || undefined,
        ...(i.quantity ? { quantity: { needed: i.quantity.needed, packed: i.quantity.packed } } : {}),
        ...(i.alwaysPack ? { alwaysPack: true } : {}),
      }),
    ),
  }));
  return { mode: local.mode, categories };
}

/** Push the local list; the server merges it and returns the result, which replaces the local list. */
export async function syncList(
  config: ServerConfig,
  list: PackingList,
): Promise<{ list: PackingList; version: string }> {
  const body = toJson(SyncListRequestSchema, create(SyncListRequestSchema, { list: toProto(list) }));
  const json = await request(config, '/api/v1/list:sync', { method: 'POST', body: JSON.stringify(body) });
  const reply = fromJson(SyncListResponseSchema, json);
  return { list: fromProto(reply.list, list), version: reply.version };
}

/**
 * Opens the WatchList server stream as Server-Sent Events and reports every version it carries:
 * one on connect, one per change on the server, and a heartbeat every 25s. Events are state, not a
 * log: comparing the version with the last sync's is enough, so a dropped connection loses nothing
 * once reconnected. Uses XMLHttpRequest because React Native's fetch cannot stream a body; the same
 * code works on the web. Returns a function that closes the stream.
 */
export function watchListVersion(
  config: ServerConfig,
  onVersion: (version: string) => void,
  onEnd: (error?: Error) => void,
): () => void {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', config.url.replace(/\/+$/, '') + '/api/v1/list:watch');
  xhr.setRequestHeader('Accept', 'text/event-stream');
  xhr.setRequestHeader('Authorization', 'Basic ' + base64(`${config.user}:${config.password}`));
  let seen = 0;
  const consume = () => {
    const text = xhr.responseText ?? '';
    let end: number;
    while ((end = text.indexOf('\n\n', seen)) !== -1) {
      const data = text
        .slice(seen, end)
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('\n');
      seen = end + 2;
      if (!data) continue;
      try {
        const version = (JSON.parse(data) as { result?: { version?: string } }).result?.version;
        if (typeof version === 'string') onVersion(version);
      } catch {
        // ignore malformed event
      }
    }
  };
  let ended = false;
  const end = (error?: Error) => {
    if (ended) return;
    ended = true;
    onEnd(error);
  };
  xhr.onprogress = consume;
  xhr.onload = () => {
    consume();
    end(xhr.status === 200 ? undefined : new Error(`Server replied ${xhr.status}`));
  };
  xhr.onerror = () => end(new Error('Stream failed'));
  xhr.send();
  return () => {
    ended = true;
    xhr.abort();
  };
}

/** Fetch the server's list without sending anything. Used when a device first connects. */
export async function getList(config: ServerConfig, local: PackingList): Promise<PackingList> {
  const json = await request(config, '/api/v1/list', { method: 'GET' });
  return fromProto(fromJson(GetListResponseSchema, json).list, local);
}

async function request(config: ServerConfig, path: string, init: RequestInit): Promise<JsonValue> {
  const res = await fetch(config.url.replace(/\/+$/, '') + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + base64(`${config.user}:${config.password}`),
    },
  });
  if (!res.ok) throw new Error(`Server replied ${res.status}`);
  return res.json();
}

// Hermes may not provide btoa; this handles UTF-8 as well.
function base64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += chars[n >> 18] + chars[(n >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? chars[n & 63] : '=';
  }
  return out;
}
