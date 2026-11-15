'use client';

import { useEffect, useState } from 'react';
import type { FeedItem, LiveState, PublicState } from '@/lib/realtime/public-state';
export type Connection = 'live' | 'polling' | 'offline';
async function load(signal: AbortSignal): Promise<LiveState> {
  const state = await fetch('/ctf/api/public/state', { signal });
  if (!state.ok) throw new Error('state');
  const feed = await fetch('/ctf/api/public/feed', { signal });
  if (!feed.ok) throw new Error('feed');
  return {
    ...((await state.json()) as PublicState),
    feed: ((await feed.json()) as { feed: FeedItem[] }).feed,
  };
}
export function useLiveState(): { state: LiveState | null; connection: Connection } {
  const [state, setState] = useState<LiveState | null>(null);
  const [fetchOk, setFetchOk] = useState(true);
  useEffect(() => {
    const abort = new AbortController();
    let pending = false;
    const refetch = async () => {
      if (pending || abort.signal.aborted) return;
      pending = true;
      try {
        const next = await load(abort.signal);
        if (!abort.signal.aborted) {
          setState((previous) => (previous && next.v < previous.v ? previous : next));
          setFetchOk(true);
        }
      } catch {
        if (!abort.signal.aborted) setFetchOk(false);
      } finally {
        pending = false;
      }
    };
    void refetch();
    const visible = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    const poll = setInterval(visible, 5000);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', visible);
    return () => {
      abort.abort();
      clearInterval(poll);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('online', visible);
    };
  }, []);
  return { state, connection: fetchOk ? 'polling' : 'offline' };
}
