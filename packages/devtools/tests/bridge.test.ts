import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
  ConnectivityClient,
  getConnectivityClient,
} from '@connectivity-js/core';
import { createDevToolsBridge } from '../src/bridge';

const createMockDetector = () => {
  let listener: ((event: { status: string; reason: string }) => void) | null =
    null;
  const detector = {
    start: (l: (event: { status: string; reason: string }) => void) => {
      listener = l;
      return () => {
        listener = null;
      };
    },
  };
  const emit = (event: { status: string; reason: string }) => {
    listener?.(event);
  };
  return { detector, emit };
};

describe('createDevToolsBridge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    ConnectivityClient.resetInstance();
  });

  test('getSnapshot returns initial snapshot', () => {
    const { detector } = createMockDetector();
    const client = getConnectivityClient({ detectors: [detector] });
    client.start();
    const bridge = createDevToolsBridge(client);

    const snap = bridge.getSnapshot();

    expect(snap.state.status).toBe('unknown');
    expect(snap.queue).toEqual([]);
    expect(snap.queueDisplay).toEqual([]);
  });

  test('subscribe notifies on state change', () => {
    const { detector, emit } = createMockDetector();
    const client = getConnectivityClient({ detectors: [detector] });
    client.start();
    const bridge = createDevToolsBridge(client);
    const listener = vi.fn();

    bridge.subscribe(listener);
    emit({ status: 'online', reason: 'test' });

    expect(listener).toHaveBeenCalled();
    expect(bridge.getSnapshot().state.status).toBe('online');
  });

  test('subscribe notifies on queue change', async () => {
    const { detector, emit } = createMockDetector();
    const client = getConnectivityClient({ detectors: [detector] });
    client.start();
    emit({ status: 'offline', reason: 'test' });

    client.registerAction('save', {
      request: vi.fn().mockResolvedValue({}),
      options: { whenOffline: 'queue' },
    });

    const bridge = createDevToolsBridge(client);
    const listener = vi.fn();
    bridge.subscribe(listener);

    await client.execute('save', { data: 1 });

    expect(listener).toHaveBeenCalled();
    expect(bridge.getSnapshot().queue.length).toBe(1);
  });

  test('unsubscribe stops notifications', () => {
    const { detector, emit } = createMockDetector();
    const client = getConnectivityClient({ detectors: [detector] });
    client.start();
    const bridge = createDevToolsBridge(client);
    const listener = vi.fn();

    const unsub = bridge.subscribe(listener);
    unsub();

    emit({ status: 'online', reason: 'test' });

    expect(listener).not.toHaveBeenCalled();
  });

  test('cancel marks job as canceled in queue', async () => {
    const { detector, emit } = createMockDetector();
    const client = getConnectivityClient({ detectors: [detector] });
    client.start();
    emit({ status: 'offline', reason: 'test' });

    client.registerAction('save', {
      request: vi.fn().mockResolvedValue({}),
      options: { whenOffline: 'queue' },
    });

    await client.execute('save', {});

    const bridge = createDevToolsBridge(client);
    const jobId = bridge.getSnapshot().queue[0].id;

    bridge.cancel(jobId);

    expect(bridge.getSnapshot().queue[0].status).toBe('canceled');
  });

  test('destroy clears listeners and unsubscribes from client', () => {
    const { detector, emit } = createMockDetector();
    const client = getConnectivityClient({ detectors: [detector] });
    client.start();
    const bridge = createDevToolsBridge(client);
    const listener = vi.fn();

    bridge.subscribe(listener);
    bridge.destroy();

    emit({ status: 'online', reason: 'test' });

    expect(listener).not.toHaveBeenCalled();
  });

  test('flush delegates to client.flush and processes jobs', async () => {
    const { detector, emit } = createMockDetector();
    const client = getConnectivityClient({ detectors: [detector] });
    client.start();
    emit({ status: 'offline', reason: 'test' });

    client.registerAction('save', {
      request: vi.fn().mockResolvedValue({}),
      options: { whenOffline: 'queue' },
    });

    await client.execute('save', {});

    const bridge = createDevToolsBridge(client);
    expect(bridge.getSnapshot().queue).toHaveLength(1);
    expect(bridge.getSnapshot().queue[0].status).toBe('queued');

    emit({ status: 'online', reason: 'test' });
    await bridge.flush();
    await vi.advanceTimersByTimeAsync(0);

    // Job transitions to succeeded after flush
    expect(bridge.getSnapshot().queue[0].status).toBe('succeeded');

    // After cleanup delay, job is removed
    await vi.advanceTimersByTimeAsync(5000);
    expect(bridge.getSnapshot().queue).toHaveLength(0);
  });
});
