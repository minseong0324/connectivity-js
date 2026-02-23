import {
  ConnectivityClient,
  type Detector,
  type DetectorEvent,
  getConnectivityClient,
} from '@connectivity/core';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { useDefaultConnectivityOptions } from '../src/connectivity-context';
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
});
