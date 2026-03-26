import type {
  ConnectivityStatus,
  ConnectivityTransition,
} from '@connectivity-js/core';
import { useEffect, useRef } from 'react';
import { useConnectivityClient } from './connectivity-context';

export type ConnectivityChangeHandlers = Partial<
  Record<ConnectivityStatus, (transition: ConnectivityTransition) => void>
>;

/**
 * Hook that runs callbacks when connectivity status changes.
 *
 * You can specify a separate handler for each status (`online`, `offline`, `unknown`).
 * Works without `ConnectivityProvider` by referencing the singleton directly.
 *
 * @param handlers - Callbacks per status transition
 *
 * @example
 * useOnConnectivityChange({
 *   offline: () => toast.warning('Connection lost.'),
 *   online: (t) => toast.success(`Reconnected after ${t.duration}ms`),
 * });
 */
export function useOnConnectivityChange(handlers: ConnectivityChangeHandlers) {
  const client = useConnectivityClient();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    return client.subscribe((_state, transition) => {
      if (transition === undefined) {
        return;
      }

      switch (transition.to) {
        case 'online': {
          handlersRef.current.online?.(transition);
          return;
        }
        case 'offline': {
          handlersRef.current.offline?.(transition);
          return;
        }
        case 'unknown': {
          handlersRef.current.unknown?.(transition);
          return;
        }
        default: {
          const _exhaustive: never = transition.to;
          throw new Error(
            `[ConnectivityClient] Unknown status: ${JSON.stringify(
              _exhaustive,
            )}`,
          );
        }
      }
    });
  }, [client]);
}
