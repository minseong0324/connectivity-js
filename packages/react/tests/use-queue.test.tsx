import {
  ConnectivityClient,
  type Detector,
  type DetectorEvent,
  getConnectivityClient,
} from '@connectivity/core';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
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
});
