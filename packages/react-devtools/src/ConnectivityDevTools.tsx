import type { ConnectivityClient } from '@connectivity-js/core';
import {
  type RenderConnectivityDevToolsOptions,
  renderConnectivityDevTools,
} from '@connectivity-js/devtools';
import { useEffect, useRef } from 'react';

export type ConnectivityDevToolsProps = {
  client: ConnectivityClient;
  enabled?: boolean;
  /**
   * Initial position of the devtools panel.
   * Read only at mount time — changing this prop after mount has no effect.
   */
  defaultPosition?: RenderConnectivityDevToolsOptions['position'];
  /**
   * Whether the panel starts open.
   * Read only at mount time — changing this prop after mount has no effect.
   */
  defaultOpen?: RenderConnectivityDevToolsOptions['initialOpen'];
};

/**
 * Mounts the Connectivity DevTools panel into the React tree.
 *
 * This is a thin React wrapper around `renderConnectivityDevTools` from
 * `@connectivity-js/devtools`. All UI logic lives in the framework-agnostic core;
 * this component only handles mounting / unmounting via a ref + useEffect.
 *
 * `defaultPosition` and `defaultOpen` are read only when the vanilla renderer
 * is (re-)mounted — on initial mount or when `client`/`enabled` changes.
 */
export function ConnectivityDevTools({
  client,
  enabled = true,
  defaultPosition,
  defaultOpen,
}: ConnectivityDevToolsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef({
    position: defaultPosition,
    initialOpen: defaultOpen,
  });
  optionsRef.current = { position: defaultPosition, initialOpen: defaultOpen };

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
