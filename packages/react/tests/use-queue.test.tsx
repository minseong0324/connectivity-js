import {
  ConnectivityClient,
  type Detector,
  type DetectorEvent,
  getConnectivityClient,
} from '@connectivity-js/core';
import { act, renderHook } from '@testing-library/react';
import { type ReactNode, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ConnectivityProvider } from '../src/connectivity-provider';
import { useQueue } from '../src/use-queue';

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

describe('useQueue', () => {
  afterEach(() => {
    ConnectivityClient.resetInstance();
  });

  test('returns the full queue', async () => {
    const mock = createMockDetector();
    getConnectivityClient({ detectors: [mock.detector] });
    mock.emit({ status: 'offline', reason: 'test' });

    const manager = getConnectivityClient();
    manager.registerAction('save', {
      request: vi.fn(),
      options: { whenOffline: 'queue' },
    });
    manager.registerAction('like', {
      request: vi.fn(),
      options: { whenOffline: 'queue' },
    });

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider detectors={[mock.detector]}>
        {children}
      </ConnectivityProvider>
    );

    await manager.execute('save', {});
    await manager.execute('like', {});

    const { result } = renderHook(() => useQueue(), { wrapper: Wrapper });
    expect(result.current.jobs).toHaveLength(2);
    expect(result.current.pendingCount).toBe(2);
  });

  test('returns only matching actions when filtered by actionKey', async () => {
    const mock = createMockDetector();
    getConnectivityClient({ detectors: [mock.detector] });
    mock.emit({ status: 'offline', reason: 'test' });

    const manager = getConnectivityClient();
    manager.registerAction('save', {
      request: vi.fn(),
      options: { whenOffline: 'queue' },
    });
    manager.registerAction('like', {
      request: vi.fn(),
      options: { whenOffline: 'queue' },
    });

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider detectors={[mock.detector]}>
        {children}
      </ConnectivityProvider>
    );

    await manager.execute('save', {});
    await manager.execute('like', {});

    const { result } = renderHook(() => useQueue({ actionKey: 'save' }), {
      wrapper: Wrapper,
    });
    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.jobs[0]?.actionKey).toBe('save');
  });

  describe('with fake timers', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test('failed job has lastError as original Error object (not stringified)', async () => {
      const mock = createMockDetector();
      getConnectivityClient({ detectors: [mock.detector] });
      mock.emit({ status: 'offline', reason: 'test' });

      const manager = getConnectivityClient();
      const serverError = new Error('server error');
      manager.registerAction('save', {
        request: vi.fn().mockRejectedValue(serverError),
        options: { whenOffline: 'queue' },
      });

      const Wrapper = ({ children }: { children: ReactNode }) => (
        <ConnectivityProvider detectors={[mock.detector]}>
          {children}
        </ConnectivityProvider>
      );

      await manager.execute('save', {});

      const { result } = renderHook(() => useQueue({ actionKey: 'save' }), {
        wrapper: Wrapper,
      });

      await act(async () => {
        mock.emit({ status: 'online', reason: 'test' });
        await vi.advanceTimersByTimeAsync(0);
      });

      const failedJob = result.current.jobs.find((j) => j.status === 'failed');
      expect(failedJob).toBeDefined();
      expect(failedJob?.lastError).toBe(serverError);
      expect(failedJob?.lastError).toBeInstanceOf(Error);
      expect((failedJob?.lastError as Error).message).toBe('server error');
    });
  });

  test('cancel removes a queued job', async () => {
    const mock = createMockDetector();
    getConnectivityClient({ detectors: [mock.detector] });
    mock.emit({ status: 'offline', reason: 'test' });

    const manager = getConnectivityClient();
    manager.registerAction('save', {
      request: vi.fn(),
      options: { whenOffline: 'queue' },
    });

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider detectors={[mock.detector]}>
        {children}
      </ConnectivityProvider>
    );

    await manager.execute('save', { data: 'test' });

    const { result } = renderHook(() => useQueue(), { wrapper: Wrapper });
    expect(result.current.jobs).toHaveLength(1);

    const jobId = result.current.jobs[0]?.id;

    if (jobId === undefined) {
      throw new Error('expected at least one job');
    }

    act(() => {
      result.current.cancel(jobId);
    });

    expect(result.current.jobs.find((j) => j.id === jobId)?.status).toBe(
      'canceled',
    );
  });

  test('retry and cancel references are stable across re-renders', () => {
    const mock = createMockDetector();
    const client = new ConnectivityClient({
      detectors: [mock.detector],
    });

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider client={client}>{children}</ConnectivityProvider>
    );

    const { result, rerender } = renderHook(
      () => {
        const queue = useQueue();
        const retryRef = useRef(queue.retry);
        const cancelRef = useRef(queue.cancel);
        const retryStable = retryRef.current === queue.retry;
        const cancelStable = cancelRef.current === queue.cancel;
        return { retryStable, cancelStable };
      },
      { wrapper: Wrapper },
    );

    rerender();

    expect(result.current.retryStable).toBe(true);
    expect(result.current.cancelStable).toBe(true);
  });
});
