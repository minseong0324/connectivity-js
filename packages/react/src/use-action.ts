import {
  ActionObserver,
  type ActionOptionsConfig,
  getConnectivityClient,
  type UseActionCallbacks,
} from '@connectivity-js/core';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useDefaultConnectivityOptions } from './connectivity-context';

const SERVER_SNAPSHOT = { pendingCount: 0, lastError: undefined };
const getServerSnapshot = () => SERVER_SNAPSHOT;

/**
 * Hook for registering and executing actions.
 *
 * Internally creates an `ActionObserver` to communicate with `ConnectivityClient`.
 *
 * @param options - Action config from `actionOptions()` (inline config also supported)
 * @param callbacks - Optional lifecycle callbacks (onSuccess, onEnqueued, onError, onSettled)
 *
 * @example
 * const { execute, pendingCount, lastError } = useAction(saveAction, {
 *   onSuccess: (result) => toast.success('Saved'),
 *   onEnqueued: (jobId) => toast.info('Offline — queued'),
 * });
 */
export function useAction<TInput, TResult>(
  options: ActionOptionsConfig<TInput, TResult>,
  callbacks?: UseActionCallbacks<TResult>,
) {
  const client = getConnectivityClient();
  const defaults = useDefaultConnectivityOptions();

  // One observer per hook — stable via useState
  const [observer] = useState(
    () => new ActionObserver(client, options, defaults.actions),
  );

  // In-place update when options change (re-registers action without re-mount)
  useEffect(() => {
    observer.setOptions(options, defaults.actions);
  }, [observer, options, defaults.actions]);

  // Callbacks updated synchronously on every render to avoid stale closures
  observer.setCallbacks(callbacks);

  const result = useSyncExternalStore(
    useCallback((cb) => observer.subscribe(cb), [observer]),
    () => observer.getCurrentResult(),
    getServerSnapshot,
  );

  const execute = useCallback(
    (input: TInput) => observer.execute(input),
    [observer],
  );

  return { execute, ...result };
}
