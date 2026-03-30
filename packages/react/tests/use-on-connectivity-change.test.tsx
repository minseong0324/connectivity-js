import {
  ConnectivityClient,
  type Detector,
  type DetectorEvent,
  getConnectivityClient,
} from '@connectivity-js/core';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ConnectivityProvider } from '../src/connectivity-provider';
import { useOnConnectivityChange } from '../src/use-on-connectivity-change';

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

describe('useOnConnectivityChange', () => {
  afterEach(() => {
    ConnectivityClient.resetInstance();
  });

  test('calls online callback on online transition', () => {
    const mock = createMockDetector();
    getConnectivityClient({ detectors: [mock.detector] });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider detectors={[mock.detector]}>
        {children}
      </ConnectivityProvider>
    );

    const online = vi.fn();
    renderHook(() => useOnConnectivityChange({ online }), { wrapper: Wrapper });

    act(() => {
      mock.emit({ status: 'online', reason: 'test' });
    });

    expect(online).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'unknown', to: 'online' }),
    );
  });

  test('calls offline callback on offline transition', () => {
    const mock = createMockDetector();
    getConnectivityClient({ detectors: [mock.detector] });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider detectors={[mock.detector]}>
        {children}
      </ConnectivityProvider>
    );

    const offline = vi.fn();
    renderHook(() => useOnConnectivityChange({ offline }), {
      wrapper: Wrapper,
    });

    act(() => {
      mock.emit({ status: 'online', reason: 'test' });
      mock.emit({ status: 'offline', reason: 'test' });
    });

    expect(offline).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'online', to: 'offline' }),
    );
  });

  test('calls unknown callback when status transitions to unknown', () => {
    const mock = createMockDetector();
    getConnectivityClient({ detectors: [mock.detector] });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider detectors={[mock.detector]}>
        {children}
      </ConnectivityProvider>
    );

    const unknown = vi.fn();
    renderHook(() => useOnConnectivityChange({ unknown }), {
      wrapper: Wrapper,
    });

    act(() => {
      mock.emit({ status: 'online', reason: 'test' });
    });

    act(() => {
      mock.emit({ status: 'unknown', reason: 'test' });
    });

    expect(unknown).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'online', to: 'unknown' }),
    );
  });

  test('does not call callback when status remains the same', () => {
    const mock = createMockDetector();
    getConnectivityClient({ detectors: [mock.detector] });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider detectors={[mock.detector]}>
        {children}
      </ConnectivityProvider>
    );

    const online = vi.fn();
    renderHook(() => useOnConnectivityChange({ online }), { wrapper: Wrapper });

    act(() => {
      mock.emit({ status: 'online', reason: 'test' });
    });
    online.mockClear();

    act(() => {
      mock.emit({ status: 'online', reason: 'test' });
    });

    expect(online).not.toHaveBeenCalled();
  });
});
