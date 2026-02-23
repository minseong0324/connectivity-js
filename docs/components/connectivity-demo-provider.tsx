'use client';

import { getConnectivityClient } from '@connectivity/core';
import { ConnectivityProvider } from '@connectivity/react';
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useRef,
} from 'react';

// ---------------------------------------------------------------------------
// Manual detector — lets us simulate online/offline from a button click
// ---------------------------------------------------------------------------

type DetectorEvent = {
  status: 'online' | 'offline' | 'unknown';
  reason: string;
};

function createManualDetector() {
  let emit: ((e: DetectorEvent) => void) | null = null;
  return {
    detector: {
      start(listener: (e: DetectorEvent) => void) {
        emit = listener;
        listener({ status: 'online', reason: 'manual' });
        return () => {
          emit = null;
        };
      },
    },
    setOnline: () => emit?.({ status: 'online', reason: 'manual' }),
    setOffline: () => emit?.({ status: 'offline', reason: 'manual' }),
  };
}

export type ManualDetector = ReturnType<typeof createManualDetector>;

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

const DemoDetectorContext = createContext<ManualDetector | null>(null);

export function useDemoDetector(): ManualDetector | null {
  return useContext(DemoDetectorContext);
}

/** For use inside Provider only. Called after ConnectivityProvider has set up the client */
const ConnectivityClientContext = createContext<ReturnType<
  typeof getConnectivityClient
> | null>(null);

export function useConnectivityClient() {
  return useContext(ConnectivityClientContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

function ClientContextInjector({ children }: { children: ReactNode }) {
  const client = getConnectivityClient();
  return (
    <ConnectivityClientContext.Provider value={client}>
      {children}
    </ConnectivityClientContext.Provider>
  );
}

export function ConnectivityDemoProvider({
  children,
}: {
  children: ReactNode;
}) {
  const detectorRef = useRef<ManualDetector | null>(null);
  if (!detectorRef.current) {
    detectorRef.current = createManualDetector();
  }
  const detector = detectorRef.current;

  const value = useMemo(() => detector, [detector]);

  return (
    <ConnectivityProvider detectors={[detector.detector]} gracePeriodMs={0}>
      <ClientContextInjector>
        <DemoDetectorContext.Provider value={value}>
          {children}
        </DemoDetectorContext.Provider>
      </ClientContextInjector>
    </ConnectivityProvider>
  );
}
