import type { ConnectivityClient } from '@connectivity-js/core';
import { createDevToolsSnapshot, type DevToolsSnapshot } from './snapshot';

export type { DevToolsSnapshot } from './snapshot';

export interface ConnectivityDevToolsBridge {
  subscribe(listener: () => void): () => void;
  getSnapshot(): DevToolsSnapshot;
  retry(jobId: string): void;
  cancel(jobId: string): void;
  flush(options?: { onlyActionKey?: string }): Promise<void>;
  destroy(): void;
}

/**
 * Bridge between ConnectivityClient and the DevTools UI.
 * subscribe + getSnapshot are compatible with useSyncExternalStore.
 */
export function createDevToolsBridge(
  client: ConnectivityClient,
): ConnectivityDevToolsBridge {
  const listeners = new Set<() => void>();
  let snapshot: DevToolsSnapshot = createDevToolsSnapshot(
    client.getState(),
    client.getQueue(),
  );

  function notify() {
    snapshot = createDevToolsSnapshot(client.getState(), client.getQueue());
    for (const listener of listeners) {
      listener();
    }
  }

  const unsubState = client.subscribe(() => notify());
  const unsubQueue = client.subscribeQueue(() => notify());

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot() {
      return snapshot;
    },

    retry(jobId: string) {
      void client.retry(jobId);
    },

    cancel(jobId: string) {
      client.cancel(jobId);
    },

    async flush(options?: { onlyActionKey?: string }) {
      await client.flush(options);
    },

    destroy() {
      unsubState();
      unsubQueue();
      listeners.clear();
    },
  };
}
