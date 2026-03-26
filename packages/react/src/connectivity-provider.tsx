import {
  ConnectivityClient,
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
  defaultOptions?: ConnectivityProviderOptions;
  onJobError?: (error: unknown, job: QueuedJob) => void;
} & (
  | { client: ConnectivityClient; detectors?: never; gracePeriodMs?: never }
  | { client?: never; detectors: Detector[]; gracePeriodMs?: number }
);

/**
 * Provider that configures {@link ConnectivityClient} and supplies default options to the React tree.
 *
 * Calls `client.start()` on mount and `client.stop()` on unmount.
 * Hooks work without the Provider by referencing the singleton directly.
 *
 * @example
 * // Recommended: instance-first
 * const client = new ConnectivityClient({
 *   detectors: [browserOnlineDetector()],
 *   gracePeriodMs: 3_000,
 * });
 * <ConnectivityProvider client={client}>
 *   <App />
 * </ConnectivityProvider>
 *
 * @example
 * // Legacy: detectors prop (still supported)
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
  defaultOptions,
  onJobError,
  ...rest
}: ConnectivityProviderProps) {
  const clientRef = useRef<ConnectivityClient | null>(null);

  if (clientRef.current === null) {
    if ('client' in rest && rest.client !== undefined) {
      clientRef.current = rest.client;
    } else if ('detectors' in rest && rest.detectors !== undefined) {
      clientRef.current = getConnectivityClient({
        detectors: rest.detectors,
        gracePeriodMs: rest.gracePeriodMs,
        onJobError,
      });
    } else {
      clientRef.current = getConnectivityClient();
    }
  }

  const client = clientRef.current;

  const onJobErrorRef = useRef(onJobError);
  onJobErrorRef.current = onJobError;

  useEffect(() => {
    client.setOnJobError((error, job) => onJobErrorRef.current?.(error, job));
    client.start();
    return () => client.stop();
  }, [client]);

  const contextValue = useMemo(
    () => ({
      client,
      defaultOptions: defaultOptions ?? {},
    }),
    [client, defaultOptions],
  );

  return (
    <ConnectivityContext.Provider value={contextValue}>
      {children}
    </ConnectivityContext.Provider>
  );
}
