import {
  ConnectivityClient,
  type Detector,
  type DetectorEvent,
  getConnectivityClient,
} from '@connectivity-js/core';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  useConnectivityClient,
  useDefaultConnectivityOptions,
} from '../src/connectivity-context';
import { ConnectivityProvider } from '../src/connectivity-provider';

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
});
