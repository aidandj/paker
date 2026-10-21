// Keeps the local list in step with the server: after every change (debounced), on launch, when the
// app returns to the foreground, and whenever the server's WatchList stream (Server-Sent Events)
// reports a version other than the one from our last sync. The stream is reopened with a short
// delay when it drops and restarted if no heartbeat arrives, so a change on another device shows
// up within about a second and nothing is missed across reconnects.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getList, ServerConfig, syncList, watchListVersion } from './api';
import { PackingList } from './types';

const CONFIG_KEY = 'paker.server.v1';
const DEBOUNCE_MS = 500;
const RECONNECT_MS = 5_000;
const WATCHDOG_MS = 60_000; // heartbeats come every 25s

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
  const version = useRef<string | null>(null); // server version after our last sync

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
      const reply = await syncList(config, sent);
      version.current = reply.version;
      // If the user edited while the request was in flight, drop this reply; the next sync carries both.
      if (listRef.current === sent) {
        adopted.current = reply.list;
        setList(reply.list);
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

  // Sync when the config is first loaded and when the app comes to the foreground; while in the
  // foreground keep the server's version stream open and sync whenever it reports a change.
  useEffect(() => {
    if (!config) return;
    let active = false;
    let close: (() => void) | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (reconnect) clearTimeout(reconnect);
      if (watchdog) clearTimeout(watchdog);
      reconnect = watchdog = null;
    };
    const open = () => {
      if (!active || close) return;
      close = watchListVersion(
        config,
        (v) => {
          armWatchdog();
          if (v === version.current) return;
          if (running.current) pending.current = true; // the running sync will go again
          else void syncNow();
        },
        () => {
          close = null;
          if (active) reconnect = setTimeout(open, RECONNECT_MS);
        },
      );
      armWatchdog();
    };
    const armWatchdog = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        close?.();
        close = null;
        open();
      }, WATCHDOG_MS);
    };
    const start = () => {
      active = true;
      void syncNow();
      open();
    };
    const stop = () => {
      active = false;
      clearTimers();
      close?.();
      close = null;
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
