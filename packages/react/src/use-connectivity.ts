import {
  type ConnectivityState,
  getConnectivityClient,
} from '@connectivity/core';
import { useCallback, useSyncExternalStore } from 'react';

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
  const client = getConnectivityClient();
  return useSyncExternalStore(
    useCallback((cb) => client.subscribe(cb), [client]),
    useCallback(() => client.getState(), [client]),
    getServerSnapshot,
  );
}
