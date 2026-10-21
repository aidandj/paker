// Keeps the local list in step with the server: after every change (debounced), on launch, when the
// app returns to the foreground, and by polling every POLL_MS while it is in the foreground (so
// changes made on another device show up without any push infrastructure). Each sync sends the
// whole list and adopts the merged reply.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getList, ServerConfig, syncList } from './api';
import { PackingList } from './types';

const CONFIG_KEY = 'paker.server.v1';
const DEBOUNCE_MS = 500;
const POLL_MS = 15_000;

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error';

export async function loadConfig(): Promise<ServerConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as ServerConfig) : null;
  } catch {
    return null;
  }
}

export async function saveConfig(config: ServerConfig | null): Promise<void> {
  if (config) await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  else await AsyncStorage.removeItem(CONFIG_KEY);
}

export function useSync(list: PackingList | null, setList: (l: PackingList) => void) {
  const [config, setConfigState] = useState<ServerConfig | null>(null);
  const [status, setStatus] = useState<SyncStatus>('off');
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef(list);
  listRef.current = list;
  const adopted = useRef<PackingList | null>(null); // last list we received from the server
  const running = useRef(false);
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeen = useRef<PackingList | null>(null); // last list the change effect looked at

  useEffect(() => {
    loadConfig().then((c) => {
      setConfigState(c);
      setStatus(c ? 'synced' : 'off');
    });
  }, []);

  const syncNow = useCallback(async () => {
    const sent = listRef.current;
    if (!config || !sent) return;
    if (running.current) {
      pending.current = true;
      return;
    }
    running.current = true;
    setStatus('syncing');
    try {
      const merged = await syncList(config, sent);
      // If the user edited while the request was in flight, drop this reply; the next sync carries both.
      if (listRef.current === sent) {
        adopted.current = merged;
        setList(merged);
      } else {
        pending.current = true;
      }
      setStatus('synced');
      setError(null);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      running.current = false;
      if (pending.current) {
        pending.current = false;
        void syncNow();
      }
    }
  }, [config, setList]);

  // Sync after local changes, debounced. A list we just adopted from the server is not a local change,
  // and neither is a config change (the foreground effect below handles that).
  useEffect(() => {
    if (list === lastSeen.current) return;
    lastSeen.current = list;
    if (!config || !list || list === adopted.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void syncNow(), DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [list, config, syncNow]);

  // Sync when the config is first loaded, when the app comes to the foreground, and on a timer
  // while it stays in the foreground.
  useEffect(() => {
    if (!config) return;
    let poll: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      void syncNow();
      if (!poll) poll = setInterval(() => void syncNow(), POLL_MS);
    };
    const stop = () => {
      if (poll) clearInterval(poll);
      poll = null;
    };
    if (AppState.currentState === 'active' || AppState.currentState === 'unknown') start();
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? start() : stop()));
    return () => {
      sub.remove();
      stop();
    };
  }, [config, syncNow]);

  /**
   * Save new server settings. Connecting to a server replaces the local list with the server's
   * (nothing local is pushed), so a device's starter data never ends up on the server. Throws if
   * the server cannot be reached, in which case nothing is saved.
   */
  const setConfig = useCallback(
    async (c: ServerConfig | null) => {
      if (c && listRef.current) {
        setStatus('syncing');
        try {
          const remote = await getList(c, listRef.current);
          adopted.current = remote;
          lastSeen.current = remote;
          setList(remote);
        } catch (e) {
          setStatus(config ? 'synced' : 'off');
          throw e;
        }
      }
      await saveConfig(c);
      setConfigState(c);
      setStatus(c ? 'synced' : 'off');
      setError(null);
    },
    [config, setList],
  );

  return { config, setConfig, status, error, syncNow };
}
