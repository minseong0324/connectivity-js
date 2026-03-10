import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ActionObserver } from '../src/action-observer';
import {
  ConnectivityClient,
  getConnectivityClient,
} from '../src/connectivity-client';
import type { Detector, DetectorEvent } from '../src/types';

const createMockDetector = () => {
  let listener: ((event: DetectorEvent) => void) | null = null;
  const detector: Detector = {
    start: (l) => {
      listener = l;
      return () => {
        listener = null;
      };
    },
  };
  const emit = (event: DetectorEvent) => {
    listener?.(event);
  };
  return { detector, emit };
};

describe('ActionObserver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    ConnectivityClient.resetInstance();
  });

  test('registers action in constructor', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'online', reason: 'test' });

    new ActionObserver(client, {
      actionKey: 'save',
      request: vi.fn().mockResolvedValue('ok'),
    });

    // action is registered, so execute should not throw
    await expect(client.execute('save', {})).resolves.toBeDefined();
  });

  test('re-registers action via setOptions', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'online', reason: 'test' });

    const fn1 = vi.fn().mockResolvedValue('v1');
    const fn2 = vi.fn().mockResolvedValue('v2');

    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: fn1,
    });

    observer.setOptions({ actionKey: 'save', request: fn2 });
    await client.execute('save', {});

    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledOnce();
  });

  test('getCurrentResult returns pendingCount and lastError', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'offline', reason: 'test' });

    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: vi.fn(),
      whenOffline: 'queue',
    });

    await observer.executeAsync({});
    await observer.executeAsync({});

    const result = observer.getCurrentResult();
    expect(result.pendingCount).toBe(2);
    expect(result.lastError).toBeUndefined();
  });

  test('onSuccess callback is called when execute succeeds', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'online', reason: 'test' });

    const onSuccess = vi.fn();
    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: async () => ({ id: '42' }),
    });
    observer.setCallbacks({ onSuccess });

    await observer.executeAsync({});

    expect(onSuccess).toHaveBeenCalledWith({ id: '42' });
  });

  test('onEnqueued callback is called when execute is queued', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'offline', reason: 'test' });

    const onEnqueued = vi.fn();
    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: vi.fn(),
      whenOffline: 'queue',
    });
    observer.setCallbacks({ onEnqueued });

    await observer.executeAsync({});

    expect(onEnqueued).toHaveBeenCalledWith(expect.stringContaining('job_'));
  });

  test('executeAsync returns ActionRunResult on success', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'online', reason: 'test' });

    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: async () => ({ id: '42' }),
    });

    const r = await observer.executeAsync({});
    expect(r).toEqual({ enqueued: false, result: { id: '42' } });
  });

  test('executeAsync always throws even when onError is provided', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'online', reason: 'test' });

    const onError = vi.fn();
    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: async () => {
        throw new Error('boom');
      },
    });
    observer.setCallbacks({ onError });

    await expect(observer.executeAsync({})).rejects.toThrow('boom');
  });

  test('executeAsync calls onError callback before throwing', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'online', reason: 'test' });

    const onError = vi.fn();
    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: async () => {
        throw new Error('boom');
      },
    });
    observer.setCallbacks({ onError });

    await observer.executeAsync({}).catch(() => {});
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom' }),
    );
  });

  test('executeAsync calls onSettled after error (via finally)', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'online', reason: 'test' });

    const onSettled = vi.fn();
    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: async () => {
        throw new Error('boom');
      },
    });
    observer.setCallbacks({ onSettled });

    await observer.executeAsync({}).catch(() => {});
    expect(onSettled).toHaveBeenCalledOnce();
  });

  test('execute (void) does not throw when onError is provided', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'online', reason: 'test' });

    const onError = vi.fn();
    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: async () => {
        throw new Error('boom');
      },
    });
    observer.setCallbacks({ onError });

    observer.execute({});
    await vi.advanceTimersByTimeAsync(0);

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom' }),
    );
  });

  test('execute (void) does not throw synchronously without onError', () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'online', reason: 'test' });

    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: async () => {
        throw new Error('boom');
      },
    });

    expect(() => observer.execute({})).not.toThrow();
  });

  test('onSettled is called on both success and failure', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'online', reason: 'test' });

    const onSettled = vi.fn();
    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: async () => 'ok',
    });
    observer.setCallbacks({ onSettled });

    await observer.executeAsync({});
    expect(onSettled).toHaveBeenCalledOnce();
  });

  test('getCurrentResult returns same reference when value is equal (memoize)', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'offline', reason: 'test' });

    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: vi.fn(),
      whenOffline: 'queue',
    });

    await observer.executeAsync({});

    const result1 = observer.getCurrentResult();
    const result2 = observer.getCurrentResult();

    // same value → same reference → useSyncExternalStore does not re-render
    expect(result1).toBe(result2);
  });

  test('getCurrentResult returns new reference when value changes', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'offline', reason: 'test' });

    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: vi.fn(),
      whenOffline: 'queue',
    });

    const result1 = observer.getCurrentResult();
    expect(result1.pendingCount).toBe(0);

    await observer.executeAsync({});

    const result2 = observer.getCurrentResult();
    expect(result2.pendingCount).toBe(1);
    expect(result1).not.toBe(result2);
  });

  test('getCurrentResult reference is preserved when other action queue changes', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'offline', reason: 'test' });

    client.registerAction('other', {
      request: vi.fn(),
      options: { whenOffline: 'queue' },
    });

    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: vi.fn(),
      whenOffline: 'queue',
    });

    await observer.executeAsync({});
    const result1 = observer.getCurrentResult();

    // add job to other action
    await client.execute('other', {});

    const result2 = observer.getCurrentResult();

    // save's pendingCount is still 1 → same reference
    expect(result1).toBe(result2);
  });

  test('registerAction after observer creation overrides the request for execute', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'online', reason: 'test' });

    const original = vi.fn().mockResolvedValue('original');
    const override = vi.fn().mockResolvedValue('override');

    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: original,
    });

    // Override the registration via client.registerAction after the observer was created.
    // NOTE: this override also replaces the onFlushSuccess/onFlushError/onFlushSettled
    // callbacks that ActionObserver had registered. As a result, when a queued offline
    // job is later flushed, those callbacks will NOT be invoked.
    // In a useAction context this is transient — the next render calls setOptions() →
    // #register(), which re-registers the observer's own callbacks.
    client.registerAction('save', { request: override, options: {} });

    const r = await observer.executeAsync({});

    // The Map override is used — original is never called
    expect(original).not.toHaveBeenCalled();
    expect(override).toHaveBeenCalledOnce();
    expect(r).toMatchObject({ enqueued: false, result: 'override' });
  });

  test('updating callback via setCallbacks invokes the latest callback', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'online', reason: 'test' });

    const onSuccess1 = vi.fn();
    const onSuccess2 = vi.fn();
    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: async () => ({ id: '42' }),
    });

    observer.setCallbacks({ onSuccess: onSuccess1 });
    observer.setCallbacks({ onSuccess: onSuccess2 }); // update

    await observer.executeAsync({});

    expect(onSuccess1).not.toHaveBeenCalled();
    expect(onSuccess2).toHaveBeenCalledOnce();
  });

  describe('flush path callbacks', () => {
    test('onSuccess and onSettled are called when flush succeeds', async () => {
      const mock = createMockDetector();
      const client = getConnectivityClient({ detectors: [mock.detector] });
      client.start();
      mock.emit({ status: 'offline', reason: 'test' });

      const onSuccess = vi.fn();
      const onSettled = vi.fn();
      const observer = new ActionObserver(client, {
        actionKey: 'save',
        request: vi.fn().mockResolvedValue({ saved: true }),
        whenOffline: 'queue',
      });
      observer.setCallbacks({ onSuccess, onSettled });

      await observer.executeAsync({});

      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);

      expect(onSuccess).toHaveBeenCalledWith({ saved: true });
      expect(onSettled).toHaveBeenCalledOnce();
    });

    test('onError and onSettled are called when flush finally fails', async () => {
      const mock = createMockDetector();
      const client = getConnectivityClient({ detectors: [mock.detector] });
      client.start();
      mock.emit({ status: 'offline', reason: 'test' });

      const onError = vi.fn();
      const onSettled = vi.fn();
      const observer = new ActionObserver(client, {
        actionKey: 'save',
        request: vi.fn().mockRejectedValue(new Error('flush failed')),
        whenOffline: 'queue',
      });
      observer.setCallbacks({ onError, onSettled });

      await observer.executeAsync({});

      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'flush failed' }),
      );
      expect(onSettled).toHaveBeenCalledOnce();
    });

    test('latest callback is called after setCallbacks update during flush', async () => {
      const mock = createMockDetector();
      const client = getConnectivityClient({ detectors: [mock.detector] });
      client.start();
      mock.emit({ status: 'offline', reason: 'test' });

      const onSuccess1 = vi.fn();
      const onSuccess2 = vi.fn();
      const observer = new ActionObserver(client, {
        actionKey: 'save',
        request: vi.fn().mockResolvedValue('ok'),
        whenOffline: 'queue',
      });

      observer.setCallbacks({ onSuccess: onSuccess1 });
      await observer.executeAsync({});

      observer.setCallbacks({ onSuccess: onSuccess2 }); // simulate re-render

      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);

      expect(onSuccess1).not.toHaveBeenCalled();
      expect(onSuccess2).toHaveBeenCalledOnce();
    });
  });
});
