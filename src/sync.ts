// Keeps the local list in step with the server: after every change (debounced), on launch and
// when the app returns to the foreground. Each sync sends the whole list and adopts the merged reply.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ServerConfig, syncList } from './api';
import { PackingList } from './types';

const CONFIG_KEY = 'paker.server.v1';
const DEBOUNCE_MS = 500;

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

  // Sync when the app comes to the foreground (and once when the config is first loaded).
  useEffect(() => {
    if (!config) return;
    void syncNow();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void syncNow();
    });
    return () => sub.remove();
  }, [config, syncNow]);

  const setConfig = useCallback(async (c: ServerConfig | null) => {
    await saveConfig(c);
    setConfigState(c);
    setStatus(c ? 'synced' : 'off');
    setError(null);
  }, []);

  return { config, setConfig, status, error, syncNow };
}
