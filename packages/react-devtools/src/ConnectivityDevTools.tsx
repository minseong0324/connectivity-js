import type { ConnectivityClient } from '@connectivity/core';
import {
  type RenderConnectivityDevToolsOptions,
  renderConnectivityDevTools,
} from '@connectivity/devtools';
import { useEffect, useRef } from 'react';

export type ConnectivityDevToolsProps = RenderConnectivityDevToolsOptions & {
  client: ConnectivityClient;
  enabled?: boolean;
};

/**
 * Mounts the Connectivity DevTools panel into the React tree.
 *
 * This is a thin React wrapper around `renderConnectivityDevTools` from
 * `@connectivity/devtools`. All UI logic lives in the framework-agnostic core;
 * this component only handles mounting / unmounting via a ref + useEffect.
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
    if (!enabled || !containerRef.current) {
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
