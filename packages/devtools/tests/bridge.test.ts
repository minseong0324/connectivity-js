import type { ConnectivityState, QueuedJob } from '@connectivity-js/core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createDevToolsBridge } from '../src/bridge';

const BASE_TIME = 1_700_000_000_000;

function makeState(
  status: ConnectivityState['status'] = 'online',
): ConnectivityState {
  return { status, since: BASE_TIME, quality: {} };
}

function makeClient(
  overrides: { state?: ConnectivityState; queue?: QueuedJob[] } = {},
) {
  let stateSubscriber: (() => void) | null = null;
  let queueSubscriber: (() => void) | null = null;

  let currentState = overrides.state ?? makeState();
  let currentQueue = overrides.queue ?? [];

  return {
    getState: vi.fn(() => currentState),
    getQueue: vi.fn(() => currentQueue),
    subscribe: vi.fn((cb: () => void) => {
      stateSubscriber = cb;
      return () => {
        stateSubscriber = null;
      };
    }),
    subscribeQueue: vi.fn((cb: () => void) => {
      queueSubscriber = cb;
      return () => {
        queueSubscriber = null;
      };
    }),
    retry: vi.fn((_jobId: string) => Promise.resolve()),
    cancel: vi.fn((_jobId: string) => {}),
    flush: vi.fn((_options?: { onlyActionKey?: string }) => Promise.resolve()),
    // helpers for triggering subscribers in tests
    _triggerState(newState: ConnectivityState) {
      currentState = newState;
      stateSubscriber?.();
    },
    _triggerQueue(newQueue: QueuedJob[]) {
      currentQueue = newQueue;
      queueSubscriber?.();
    },
  };
}

describe('createDevToolsBridge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('getSnapshot returns initial snapshot', () => {
    const state = makeState('offline');
    const client = makeClient({ state });
    const bridge = createDevToolsBridge(client as never);

    const snapshot = bridge.getSnapshot();
    expect(snapshot.state).toEqual(state);
    expect(snapshot.queue).toEqual([]);

    bridge.destroy();
  });

  test('subscribe listener is called when state changes', () => {
    const client = makeClient();
    const bridge = createDevToolsBridge(client as never);
    const listener = vi.fn();

    bridge.subscribe(listener);
    client._triggerState(makeState('offline'));

    expect(listener).toHaveBeenCalledTimes(1);

    bridge.destroy();
  });

  test('subscribe listener is called when queue changes', () => {
    const client = makeClient();
    const bridge = createDevToolsBridge(client as never);
    const listener = vi.fn();

    bridge.subscribe(listener);

    const newQueue: QueuedJob[] = [
      {
        id: 'job_1',
        actionKey: 'save',
        input: { id: '1' },
        createdAt: BASE_TIME,
        attempt: 1,
        status: 'queued',
      },
    ];
    client._triggerQueue(newQueue);

    expect(listener).toHaveBeenCalledTimes(1);

    bridge.destroy();
  });

  test('snapshot is updated after state change', () => {
    const client = makeClient({ state: makeState('online') });
    const bridge = createDevToolsBridge(client as never);

    const offlineState = makeState('offline');
    client._triggerState(offlineState);

    expect(bridge.getSnapshot().state).toEqual(offlineState);

    bridge.destroy();
  });

  test('unsubscribe removes listener', () => {
    const client = makeClient();
    const bridge = createDevToolsBridge(client as never);
    const listener = vi.fn();

    const unsubscribe = bridge.subscribe(listener);
    unsubscribe();

    client._triggerState(makeState('offline'));

    expect(listener).toHaveBeenCalledTimes(0);

    bridge.destroy();
  });

  test('destroy unsubscribes from client', () => {
    const client = makeClient();
    const bridge = createDevToolsBridge(client as never);
    const listener = vi.fn();

    bridge.subscribe(listener);
    bridge.destroy();

    client._triggerState(makeState('offline'));

    expect(listener).toHaveBeenCalledTimes(0);
  });

  test('destroy clears all listeners', () => {
    const client = makeClient();
    const bridge = createDevToolsBridge(client as never);
    const listenerA = vi.fn();
    const listenerB = vi.fn();

    bridge.subscribe(listenerA);
    bridge.subscribe(listenerB);
    bridge.destroy();

    client._triggerState(makeState('offline'));

    expect(listenerA).toHaveBeenCalledTimes(0);
    expect(listenerB).toHaveBeenCalledTimes(0);
  });

  test('retry delegates to client.retry', async () => {
    const client = makeClient();
    const bridge = createDevToolsBridge(client as never);

    bridge.retry('job_1');

    await vi.runAllTimersAsync();
    expect(client.retry).toHaveBeenCalledWith('job_1');

    bridge.destroy();
  });

  test('cancel delegates to client.cancel', () => {
    const client = makeClient();
    const bridge = createDevToolsBridge(client as never);

    bridge.cancel('job_2');

    expect(client.cancel).toHaveBeenCalledWith('job_2');

    bridge.destroy();
  });

  test('flush delegates to client.flush', async () => {
    const client = makeClient();
    const bridge = createDevToolsBridge(client as never);

    await bridge.flush({ onlyActionKey: 'save' });

    expect(client.flush).toHaveBeenCalledWith({ onlyActionKey: 'save' });

    bridge.destroy();
  });

  test('flush without options delegates to client.flush with no args', async () => {
    const client = makeClient();
    const bridge = createDevToolsBridge(client as never);

    await bridge.flush();

    expect(client.flush).toHaveBeenCalledWith(undefined);

    bridge.destroy();
  });
});
