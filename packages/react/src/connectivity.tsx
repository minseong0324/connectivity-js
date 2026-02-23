import { getConnectivityClient } from '@connectivity-js/core';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useDefaultConnectivityOptions } from './connectivity-context';

type ConnectivityProps = {
  fallback?: React.ReactNode;
  delayMs?: number;
  children: React.ReactNode;
};

const SERVER_STATUS = 'unknown';
const getServerStatus = () => SERVER_STATUS;

/**
 * Component that declaratively conditionally renders based on connectivity status.
 *
 * @example
 * <Connectivity fallback={<OfflineBanner />} delayMs={2000}>
 *   <App />
 * </Connectivity>
 */
export function Connectivity({
  fallback,
  delayMs,
  children,
}: ConnectivityProps) {
  const client = getConnectivityClient();
  const defaults = useDefaultConnectivityOptions();

  const status = useSyncExternalStore(
    useCallback((cb) => client.subscribe(cb), [client]),
    useCallback(() => client.getState().status, [client]),
    getServerStatus,
  );

  const isOnline = status !== 'offline';

  const resolvedFallback = fallback ?? defaults.connectivity?.fallback ?? null;
  const resolvedDelayMs = delayMs ?? defaults.connectivity?.delayMs ?? 0;

  const [committed, setCommitted] = useState(!isOnline && resolvedDelayMs <= 0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOnline) {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setCommitted(false);
      return;
    }

    if (resolvedDelayMs <= 0) {
      setCommitted(true);
      return;
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setCommitted(true);
    }, resolvedDelayMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOnline, resolvedDelayMs]);

  return committed ? resolvedFallback : children;
}
