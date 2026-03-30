import {
  ConnectivityClient,
  getConnectivityClient,
} from '@connectivity-js/core';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  useConnectivityClient,
  useDefaultConnectivityOptions,
} from '../src/connectivity-context';
import { ConnectivityProvider } from '../src/connectivity-provider';
import { createMockDetector } from './test-utils';

describe('ConnectivityProvider', () => {
  afterEach(() => {
    ConnectivityClient.resetInstance();
  });

  test('sets up the singleton', () => {
    const mock = createMockDetector();
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider detectors={[mock.detector]}>
        {children}
      </ConnectivityProvider>
    );

    renderHook(() => null, { wrapper: Wrapper });

    // Verify singleton was created
    const manager = getConnectivityClient();
    expect(manager).toBeDefined();
    expect(manager.getState().status).toBe('unknown');
  });

  test('provides defaultOptions via context', () => {
    const mock = createMockDetector();
    getConnectivityClient({ detectors: [mock.detector] });

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider
        detectors={[mock.detector]}
        defaultOptions={{ actions: { whenOffline: 'queue' } }}
      >
        {children}
      </ConnectivityProvider>
    );

    const { result } = renderHook(() => useDefaultConnectivityOptions(), {
      wrapper: Wrapper,
    });
    expect(result.current.actions?.whenOffline).toBe('queue');
  });

  test('provides defaultOptions.connectivity', () => {
    const mock = createMockDetector();
    getConnectivityClient({ detectors: [mock.detector] });

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider
        detectors={[mock.detector]}
        defaultOptions={{ connectivity: { delayMs: 2000 } }}
      >
        {children}
      </ConnectivityProvider>
    );

    const { result } = renderHook(() => useDefaultConnectivityOptions(), {
      wrapper: Wrapper,
    });
    expect(result.current.connectivity?.delayMs).toBe(2000);
  });

  test('useDefaultConnectivityOptions returns empty object without Provider', () => {
    getConnectivityClient({ detectors: [] });

    const { result } = renderHook(() => useDefaultConnectivityOptions());
    expect(result.current).toEqual({});
  });

  test('accepts a client prop', () => {
    const mock = createMockDetector();
    const client = new ConnectivityClient({
      detectors: [mock.detector],
    });

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider client={client}>{children}</ConnectivityProvider>
    );

    const { result } = renderHook(() => useConnectivityClient(), {
      wrapper: Wrapper,
    });
    expect(result.current).toBe(client);
  });

  test('calls stop() on unmount instead of destroy()', () => {
    const mock = createMockDetector();
    const client = new ConnectivityClient({
      detectors: [mock.detector],
    });
    const stopSpy = vi.spyOn(client, 'stop');

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider client={client}>{children}</ConnectivityProvider>
    );

    const { unmount } = renderHook(() => null, { wrapper: Wrapper });

    unmount();
    expect(stopSpy).toHaveBeenCalled();
  });

  test('useConnectivityClient falls back to singleton outside Provider', () => {
    const mock = createMockDetector();
    const singleton = getConnectivityClient({
      detectors: [mock.detector],
    });

    const { result } = renderHook(() => useConnectivityClient());
    expect(result.current).toBe(singleton);
  });

  test('client prop takes precedence over singleton', () => {
    const mock1 = createMockDetector();
    const mock2 = createMockDetector();

    // Create singleton first
    getConnectivityClient({ detectors: [mock1.detector] });

    // Create separate instance
    const client = new ConnectivityClient({
      detectors: [mock2.detector],
    });

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider client={client}>{children}</ConnectivityProvider>
    );

    const { result } = renderHook(() => useConnectivityClient(), {
      wrapper: Wrapper,
    });
    expect(result.current).toBe(client);
  });

  test('defaultOptions reference is stable when top-level values are the same', () => {
    const mock = createMockDetector();
    const client = new ConnectivityClient({
      detectors: [mock.detector],
    });

    const actionsObj = { whenOffline: 'queue' as const };
    const optionsSnapshots: unknown[] = [];

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider
        client={client}
        defaultOptions={{ actions: actionsObj }}
      >
        {children}
      </ConnectivityProvider>
    );

    const { rerender } = renderHook(
      () => {
        const opts = useDefaultConnectivityOptions();
        optionsSnapshots.push(opts);
        return opts;
      },
      { wrapper: Wrapper },
    );

    // Re-render triggers a new wrapper render with a new { actions: actionsObj } literal,
    // but shallowEqual sees the same top-level `actions` reference so the ref stays stable.
    rerender();

    expect(optionsSnapshots.length).toBeGreaterThanOrEqual(2);
    expect(optionsSnapshots[0]).toBe(optionsSnapshots[1]);
  });

  describe('onJobError', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test('is called when a queued job fails on flush', async () => {
      const mock = createMockDetector();
      const client = new ConnectivityClient({
        detectors: [mock.detector],
      });

      const serverError = new Error('server error');
      client.registerAction('save', {
        request: vi.fn().mockRejectedValue(serverError),
        options: { whenOffline: 'queue' },
      });

      const onJobError = vi.fn();
      const Wrapper = ({ children }: { children: ReactNode }) => (
        <ConnectivityProvider client={client} onJobError={onJobError}>
          {children}
        </ConnectivityProvider>
      );

      renderHook(() => null, { wrapper: Wrapper });

      await act(async () => {
        mock.emit({ status: 'offline', reason: 'test' });
      });

      await client.execute('save', { data: 'test' });

      await act(async () => {
        mock.emit({ status: 'online', reason: 'test' });
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(onJobError).toHaveBeenCalledWith(
        serverError,
        expect.objectContaining({ actionKey: 'save', status: 'failed' }),
      );
    });
  });

  test('cleans up onJobError handler on unmount', () => {
    const mock = createMockDetector();
    const client = new ConnectivityClient({
      detectors: [mock.detector],
    });
    const setOnJobErrorSpy = vi.spyOn(client, 'setOnJobError');

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider client={client} onJobError={() => {}}>
        {children}
      </ConnectivityProvider>
    );

    const { unmount } = renderHook(() => null, { wrapper: Wrapper });

    unmount();

    // Last call to setOnJobError should be with undefined (cleanup)
    const lastCall =
      setOnJobErrorSpy.mock.calls[setOnJobErrorSpy.mock.calls.length - 1];
    expect(lastCall?.[0]).toBeUndefined();
  });
});
