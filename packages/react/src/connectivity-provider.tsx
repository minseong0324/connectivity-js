import {
  type Detector,
  getConnectivityClient,
  type QueuedJob,
} from '@connectivity-js/core';
import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import {
  ConnectivityContext,
  type ConnectivityProviderOptions,
} from './connectivity-context';

type ConnectivityProviderProps = {
  children: ReactNode;
  detectors: Detector[];
  gracePeriodMs?: number;
  onJobError?: (error: unknown, job: QueuedJob) => void;
  defaultOptions?: ConnectivityProviderOptions;
};

/**
 * Provider that configures {@link ConnectivityClient} and supplies default options to the React tree.
 *
 * Calls `client.start()` on mount and `client.destroy()` on unmount.
 * Hooks work without the Provider by referencing the singleton directly.
 *
 * @example
 * <ConnectivityProvider
 *   detectors={[browserOnlineDetector()]}
 *   gracePeriodMs={3_000}
 *   defaultOptions={{
 *     actions: { whenOffline: 'queue' },
 *     connectivity: { fallback: <OfflineScreen />, delayMs: 2000 },
 *   }}
 * >
 *   <App />
 * </ConnectivityProvider>
 */
export function ConnectivityProvider({
  children,
  detectors,
  gracePeriodMs,
  onJobError,
  defaultOptions,
}: ConnectivityProviderProps) {
  const configuredRef = useRef(false);
  if (!configuredRef.current) {
    getConnectivityClient({ detectors, gracePeriodMs, onJobError });
    configuredRef.current = true;
  }

  const onJobErrorRef = useRef(onJobError);
  onJobErrorRef.current = onJobError;

  useEffect(() => {
    const client = getConnectivityClient();
    client.setOnJobError((error, job) => onJobErrorRef.current?.(error, job));
    client.start();
    return () => client.destroy();
  }, []);

  const contextValue = useMemo(
    () => ({ defaultOptions: defaultOptions ?? {} }),
    [defaultOptions],
  );

  return (
    <ConnectivityContext.Provider value={contextValue}>
      {children}
    </ConnectivityContext.Provider>
  );
}
