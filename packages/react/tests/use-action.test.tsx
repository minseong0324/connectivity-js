import {
  actionOptions,
  ConnectivityClient,
  type Detector,
  type DetectorEvent,
  getConnectivityClient,
} from '@connectivity-js/core';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ConnectivityProvider } from '../src/connectivity-provider';
import { useAction } from '../src/use-action';

const createMockDetector = () => {
  let listener: ((event: DetectorEvent) => void) | null = null;
  const detector: Detector = {
    start: (l: (event: DetectorEvent) => void) => {
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

const createTestWrapper = () => {
  const mock = createMockDetector();
  getConnectivityClient({ detectors: [mock.detector] });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <ConnectivityProvider detectors={[mock.detector]}>
      {children}
    </ConnectivityProvider>
  );
  return { Wrapper, mock };
};

const testAction = actionOptions({
  actionKey: 'purchase',
  request: async (_input: { orderId: string }) => ({ id: '42' }),
});

describe('useAction', () => {
  afterEach(() => {
    ConnectivityClient.resetInstance();
  });

  test('execute return value is a discriminated union', async () => {
    const { Wrapper, mock } = createTestWrapper();
    getConnectivityClient().registerAction('purchase', {
      request: async () => ({ id: '42' }),
      options: {},
    });

    const { result } = renderHook(() => useAction(testAction), {
      wrapper: Wrapper,
    });

    await act(async () => {
      mock.emit({ status: 'online', reason: 'test' });
    });

    let returned: unknown;
    await act(async () => {
      returned = await result.current.execute({ orderId: '1' });
    });
    expect(returned).toEqual({ enqueued: false, result: { id: '42' } });
  });

  test('pendingCount returns the number of pending jobs for the action', async () => {
    const { Wrapper, mock } = createTestWrapper();
    getConnectivityClient().registerAction('purchase', {
      request: vi.fn(),
      options: { whenOffline: 'queue' },
    });

    const { result } = renderHook(() => useAction(testAction), {
      wrapper: Wrapper,
    });

    await act(async () => {
      mock.emit({ status: 'offline', reason: 'test' });
    });

    await act(async () => {
      await result.current.execute({ orderId: '1' });
      await result.current.execute({ orderId: '2' });
    });
    expect(result.current.pendingCount).toBe(2);
  });

  test('calls onSuccess when action executes immediately', async () => {
    const { Wrapper, mock } = createTestWrapper();
    getConnectivityClient().registerAction('purchase', {
      request: async () => ({ id: '42' }),
      options: {},
    });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useAction(testAction, { onSuccess }), {
      wrapper: Wrapper,
    });

    await act(async () => {
      mock.emit({ status: 'online', reason: 'test' });
    });

    await act(async () => {
      await result.current.execute({ orderId: '1' });
    });
    expect(onSuccess).toHaveBeenCalledWith({ id: '42' });
  });

  test('calls onEnqueued when action is queued', async () => {
    const { Wrapper, mock } = createTestWrapper();
    getConnectivityClient().registerAction('purchase', {
      request: vi.fn(),
      options: { whenOffline: 'queue' },
    });

    const onEnqueued = vi.fn();
    const { result } = renderHook(() => useAction(testAction, { onEnqueued }), {
      wrapper: Wrapper,
    });

    await act(async () => {
      mock.emit({ status: 'offline', reason: 'test' });
    });

    await act(async () => {
      await result.current.execute({ orderId: '1' });
    });
    expect(onEnqueued).toHaveBeenCalledWith(expect.stringContaining('job_'));
  });

  test('swallows error when onError is provided', async () => {
    const { Wrapper, mock } = createTestWrapper();

    const onError = vi.fn();
    const { result } = renderHook(() => useAction(testAction, { onError }), {
      wrapper: Wrapper,
    });

    // Override with registerAction after useAction — the override is respected, causing a throw
    getConnectivityClient().registerAction('purchase', {
      request: async () => {
        throw new Error('failed');
      },
      options: {},
    });

    await act(async () => {
      mock.emit({ status: 'online', reason: 'test' });
    });

    await act(async () => {
      const r = await result.current.execute({ orderId: '1' });
      expect(r).toBeUndefined();
    });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'failed' }),
    );
  });

  test('calls onSettled on success', async () => {
    const { Wrapper, mock } = createTestWrapper();
    getConnectivityClient().registerAction('purchase', {
      request: async () => 'ok',
      options: {},
    });

    const onSettled = vi.fn();
    const { result } = renderHook(() => useAction(testAction, { onSettled }), {
      wrapper: Wrapper,
    });

    await act(async () => {
      mock.emit({ status: 'online', reason: 'test' });
    });

    await act(async () => {
      await result.current.execute({ orderId: '1' });
    });
    expect(onSettled).toHaveBeenCalledOnce();
  });

  describe('flush path callbacks', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    test('flush success calls onSuccess and onSettled', async () => {
      const { Wrapper, mock } = createTestWrapper();
      const request = vi.fn().mockResolvedValue({ id: '42' });
      const action = actionOptions({
        actionKey: 'purchase',
        request,
        whenOffline: 'queue',
      });

      const onSuccess = vi.fn();
      const onSettled = vi.fn();
      const { result } = renderHook(
        () => useAction(action, { onSuccess, onSettled }),
        { wrapper: Wrapper },
      );

      await act(async () => {
        mock.emit({ status: 'offline', reason: 'test' });
      });

      await act(async () => {
        await result.current.execute({ orderId: '1' });
      });

      await act(async () => {
        mock.emit({ status: 'online', reason: 'test' });
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(onSuccess).toHaveBeenCalledWith({ id: '42' });
      expect(onSettled).toHaveBeenCalledOnce();
    });

    test('flush final failure calls onError and onSettled', async () => {
      const { Wrapper, mock } = createTestWrapper();
      const request = vi.fn().mockRejectedValue(new Error('server error'));
      const action = actionOptions({
        actionKey: 'purchase',
        request,
        whenOffline: 'queue',
      });

      const onError = vi.fn();
      const onSettled = vi.fn();
      const { result } = renderHook(
        () => useAction(action, { onError, onSettled }),
        { wrapper: Wrapper },
      );

      await act(async () => {
        mock.emit({ status: 'offline', reason: 'test' });
      });

      await act(async () => {
        await result.current.execute({ orderId: '1' });
      });

      await act(async () => {
        mock.emit({ status: 'online', reason: 'test' });
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'server error' }),
      );
      expect(onSettled).toHaveBeenCalledOnce();
    });

    test('enqueue does not call onSettled', async () => {
      const { Wrapper, mock } = createTestWrapper();
      const request = vi.fn().mockResolvedValue({ id: '42' });
      const action = actionOptions({
        actionKey: 'purchase',
        request,
        whenOffline: 'queue',
      });

      const onSettled = vi.fn();
      const { result } = renderHook(() => useAction(action, { onSettled }), {
        wrapper: Wrapper,
      });

      await act(async () => {
        mock.emit({ status: 'offline', reason: 'test' });
      });

      await act(async () => {
        await result.current.execute({ orderId: '1' });
      });

      expect(onSettled).not.toHaveBeenCalled();
    });
  });
});
