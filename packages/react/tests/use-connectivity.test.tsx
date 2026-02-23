import {
  ConnectivityClient,
  type Detector,
  type DetectorEvent,
  getConnectivityClient,
} from '@connectivity-js/core';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { ConnectivityProvider } from '../src/connectivity-provider';
import { useConnectivity } from '../src/use-connectivity';

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

describe('useConnectivity', () => {
  afterEach(() => {
    ConnectivityClient.resetInstance();
  });

  test('returns current state', () => {
    const mock = createMockDetector();
    getConnectivityClient({ detectors: [mock.detector] });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider detectors={[mock.detector]}>
        {children}
      </ConnectivityProvider>
    );

    const { result } = renderHook(() => useConnectivity(), {
      wrapper: Wrapper,
    });

    act(() => {
      mock.emit({ status: 'online', reason: 'test' });
    });

    expect(result.current.status).toBe('online');
  });

  test('initial status is unknown', () => {
    getConnectivityClient({ detectors: [] });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider detectors={[]}>{children}</ConnectivityProvider>
    );

    const { result } = renderHook(() => useConnectivity(), {
      wrapper: Wrapper,
    });
    expect(result.current.status).toBe('unknown');
  });
});
