import type { QueuedJob } from '@connectivity-js/core';
import { useCallback, useSyncExternalStore } from 'react';
import { useConnectivityClient } from './connectivity-context';

const EMPTY_JOBS: QueuedJob[] = [];
const getServerSnapshot = () => EMPTY_JOBS;

/**
 * Hook that subscribes to and controls the offline queue job list.
 *
 * @param filter - Optional filter options
 * @param filter.actionKey - Action key when querying only jobs for a specific action
 *
 * @example
 * const { jobs, pendingCount, retry, cancel } = useQueue({ actionKey: 'save' });
 */
export function useQueue(filter?: { actionKey?: string }) {
  const client = useConnectivityClient();

  const subscribe = useCallback(
    (cb: () => void) => client.subscribeQueue(cb),
    [client],
  );

  const getSnapshot = useCallback(() => {
    if (filter?.actionKey !== undefined) {
      return client.getActionQueue(filter.actionKey);
    }
    return client.getQueue();
  }, [client, filter?.actionKey]);

  const jobs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const pendingCount = jobs.filter(
    (j) => j.status === 'queued' || j.status === 'running',
  ).length;

  const retry = useCallback((jobId: string) => client.retry(jobId), [client]);
  const cancel = useCallback((jobId: string) => client.cancel(jobId), [client]);

  return { jobs, pendingCount, retry, cancel };
}
