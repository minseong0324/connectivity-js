import type { ActionOptions, ConnectivityClient } from '@connectivity-js/core';
import { getConnectivityClient } from '@connectivity-js/core';
import { createContext, type ReactNode, useContext } from 'react';

/**
 * Type for the `defaultOptions` prop of `ConnectivityProvider`
 *
 * Default configuration passed down the tree via the Provider.
 */
export interface ConnectivityProviderOptions {
  /** Default options applied to all actions */
  actions?: Partial<ActionOptions>;
  /** Default values for the `Connectivity` component */
  connectivity?: {
    /** Fallback UI to display when offline */
    fallback?: ReactNode;
    /** Delay in milliseconds before UI changes on offline transition */
    delayMs?: number;
  };
}

export const ClientContext = createContext<ConnectivityClient | null>(null);
export const DefaultOptionsContext = createContext<ConnectivityProviderOptions>(
  {},
);

/**
 * Returns the ConnectivityClient from the nearest Provider.
 * Falls back to the singleton when used outside a Provider.
 */
export function useConnectivityClient() {
  const client = useContext(ClientContext);
  if (client !== null) {
    return client;
  }
  if (
    typeof process !== 'undefined' &&
    typeof process.env !== 'undefined' &&
    process.env.NODE_ENV !== 'production'
  ) {
    console.warn(
      '[connectivity-js] Hook called outside ConnectivityProvider. ' +
        'Falling back to singleton. Wrap your app in <ConnectivityProvider>.',
    );
  }
  return getConnectivityClient();
}

/**
 * Internal hook to read default options set by the Provider.
 * Returns an empty object when called outside the Provider.
 *
 * @internal
 */
export function useDefaultConnectivityOptions() {
  return useContext(DefaultOptionsContext);
}
