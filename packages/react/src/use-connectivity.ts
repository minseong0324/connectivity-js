import type { ConnectivityState } from '@connectivity-js/core';
import { useCallback, useSyncExternalStore } from 'react';
import { useConnectivityClient } from './connectivity-context';

const SERVER_SNAPSHOT: ConnectivityState = {
  status: 'unknown',
  since: 0,
  quality: {},
};
const getServerSnapshot = () => SERVER_SNAPSHOT;

/**
 * Hook that subscribes to the current connectivity state.
 *
 * @returns Current {@link ConnectivityState} snapshot
 *
 * @example
 * const { status, quality } = useConnectivity();
 * if (status === 'offline') return <OfflineBanner />;
 */
export function useConnectivity() {
  const client = useConnectivityClient();
  return useSyncExternalStore(
    useCallback((cb) => client.subscribe(cb), [client]),
    useCallback(() => client.getState(), [client]),
    getServerSnapshot,
  );
}
