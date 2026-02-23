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

  test('constructor에서 action을 등록한다', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'online', reason: 'test' });

    new ActionObserver(client, {
      actionKey: 'save',
      request: vi.fn().mockResolvedValue('ok'),
    });

    // action이 등록되었으므로 execute가 throw하지 않아야 함
    await expect(client.execute('save', {})).resolves.toBeDefined();
  });

  test('setOptions로 action을 재등록한다', async () => {
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

  test('getCurrentResult가 pendingCount와 lastError를 반환한다', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'offline', reason: 'test' });

    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: vi.fn(),
      whenOffline: 'queue',
    });

    await observer.execute({});
    await observer.execute({});

    const result = observer.getCurrentResult();
    expect(result.pendingCount).toBe(2);
    expect(result.lastError).toBeUndefined();
  });

  test('execute 성공 시 onSuccess callback이 호출된다', async () => {
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

    await observer.execute({});

    expect(onSuccess).toHaveBeenCalledWith({ id: '42' });
  });

  test('execute 큐잉 시 onEnqueued callback이 호출된다', async () => {
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

    await observer.execute({});

    expect(onEnqueued).toHaveBeenCalledWith(expect.stringContaining('job_'));
  });

  test('execute 실패 + onError callback이 에러를 삼킨다', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'online', reason: 'test' });

    const onError = vi.fn();
    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: async () => {
        throw new Error('실패');
      },
    });
    observer.setCallbacks({ onError });

    const result = await observer.execute({});

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: '실패' }),
    );
    expect(result).toBeUndefined();
  });

  test('onSettled가 성공/실패 모두에서 호출된다', async () => {
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

    await observer.execute({});
    expect(onSettled).toHaveBeenCalledOnce();
  });

  test('getCurrentResult는 값이 같으면 동일 참조를 반환한다 (memoize)', async () => {
    const mock = createMockDetector();
    const client = getConnectivityClient({ detectors: [mock.detector] });
    client.start();
    mock.emit({ status: 'offline', reason: 'test' });

    const observer = new ActionObserver(client, {
      actionKey: 'save',
      request: vi.fn(),
      whenOffline: 'queue',
    });

    await observer.execute({});

    const result1 = observer.getCurrentResult();
    const result2 = observer.getCurrentResult();

    // 값이 같으므로 같은 참조 → useSyncExternalStore가 re-render하지 않음
    expect(result1).toBe(result2);
  });

  test('getCurrentResult는 값이 달라지면 새 참조를 반환한다', async () => {
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

    await observer.execute({});

    const result2 = observer.getCurrentResult();
    expect(result2.pendingCount).toBe(1);
    expect(result1).not.toBe(result2);
  });

  test('다른 action의 큐 변경 시 getCurrentResult 참조가 유지된다', async () => {
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

    await observer.execute({});
    const result1 = observer.getCurrentResult();

    // 다른 action에 job 추가
    await client.execute('other', {});

    const result2 = observer.getCurrentResult();

    // save의 pendingCount는 여전히 1 → 같은 참조
    expect(result1).toBe(result2);
  });

  test('setCallbacks로 callback을 갱신하면 최신 callback이 호출된다', async () => {
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
    observer.setCallbacks({ onSuccess: onSuccess2 }); // 갱신

    await observer.execute({});

    expect(onSuccess1).not.toHaveBeenCalled();
    expect(onSuccess2).toHaveBeenCalledOnce();
  });
});
