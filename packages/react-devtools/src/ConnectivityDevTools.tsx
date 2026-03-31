import type { ConnectivityClient } from '@connectivity-js/core';
import {
  type RenderConnectivityDevToolsOptions,
  renderConnectivityDevTools,
} from '@connectivity-js/devtools';
import { useEffect, useRef } from 'react';

export type ConnectivityDevToolsProps = RenderConnectivityDevToolsOptions & {
  client: ConnectivityClient;
  enabled?: boolean;
};

/**
 * Mounts the Connectivity DevTools panel into the React tree.
 *
 * This is a thin React wrapper around `renderConnectivityDevTools` from
 * `@connectivity-js/devtools`. All UI logic lives in the framework-agnostic core;
 * this component only handles mounting / unmounting via a ref + useEffect.
 *
 * **Note:** The `position` prop is read only when the vanilla renderer is
 * (re-)mounted — on initial mount or when `client`/`enabled` changes.
 * Changing `position` alone does not trigger a re-mount because it is
 * not in the effect's dependency array.
 */
export function ConnectivityDevTools({
  client,
  enabled = true,
  ...options
}: ConnectivityDevToolsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!enabled || containerRef.current === null) {
      return;
    }
    return renderConnectivityDevTools(
      containerRef.current,
      client,
      optionsRef.current,
    );
  }, [client, enabled]);

  if (!enabled) {
    return null;
  }
  return <div ref={containerRef} />;
}
