import {
  ConnectivityClient,
  getConnectivityClient,
} from '@connectivity-js/core';
import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Connectivity } from '../src/connectivity';
import { ConnectivityProvider } from '../src/connectivity-provider';
import { createMockDetector } from './test-utils';

describe('Connectivity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    ConnectivityClient.resetInstance();
  });

  test('renders children when online', () => {
    const mock = createMockDetector();
    getConnectivityClient({ detectors: [mock.detector] });

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider detectors={[mock.detector]}>
        {children}
      </ConnectivityProvider>
    );

    render(
      <Wrapper>
        <Connectivity fallback={<div>Offline</div>}>
          <div>Online</div>
        </Connectivity>
      </Wrapper>,
    );

    act(() => {
      mock.emit({ status: 'online', reason: 'test' });
    });

    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  test('renders fallback when offline', () => {
    const mock = createMockDetector();
    getConnectivityClient({ detectors: [mock.detector] });

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider detectors={[mock.detector]}>
        {children}
      </ConnectivityProvider>
    );

    render(
      <Wrapper>
        <Connectivity fallback={<div>Offline</div>}>
          <div>Online</div>
        </Connectivity>
      </Wrapper>,
    );

    act(() => {
      mock.emit({ status: 'offline', reason: 'test' });
    });

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  test('delays offline transition when delayMs is set', () => {
    const mock = createMockDetector();
    getConnectivityClient({ detectors: [mock.detector] });

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider detectors={[mock.detector]}>
        {children}
      </ConnectivityProvider>
    );

    render(
      <Wrapper>
        <Connectivity fallback={<div>Offline</div>} delayMs={2000}>
          <div>Online</div>
        </Connectivity>
      </Wrapper>,
    );

    act(() => {
      mock.emit({ status: 'online', reason: 'test' });
    });

    act(() => {
      mock.emit({ status: 'offline', reason: 'test' });
    });

    // Still in delay, so children remain
    expect(screen.getByText('Online')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // After delay, switch to fallback
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  test('inherits fallback/delayMs from defaultOptions.connectivity', () => {
    const mock = createMockDetector();
    getConnectivityClient({ detectors: [mock.detector] });

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider
        detectors={[mock.detector]}
        defaultOptions={{
          connectivity: { fallback: <div>default offline</div> },
        }}
      >
        {children}
      </ConnectivityProvider>
    );

    render(
      <Wrapper>
        <Connectivity>
          <div>Online</div>
        </Connectivity>
      </Wrapper>,
    );

    act(() => {
      mock.emit({ status: 'offline', reason: 'test' });
    });

    expect(screen.getByText('default offline')).toBeInTheDocument();
  });

  test('renders children (not fallback) when status is unknown (initial state)', () => {
    const mock = createMockDetector();
    getConnectivityClient({ detectors: [mock.detector] });

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ConnectivityProvider detectors={[mock.detector]}>
        {children}
      </ConnectivityProvider>
    );

    render(
      <Wrapper>
        <Connectivity fallback={<div>Offline</div>}>
          <div>Online</div>
        </Connectivity>
      </Wrapper>,
    );

    // No detector emit -> status stays 'unknown'
    // isOnline = status !== 'offline' -> true for 'unknown'
    // So children should render, not fallback
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
  });
});
