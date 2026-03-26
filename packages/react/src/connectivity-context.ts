import type {
  ActionOptions,
  ConnectivityClient,
} from '@connectivity-js/core';
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

type ConnectivityContextValue = {
  client: ConnectivityClient;
  defaultOptions: ConnectivityProviderOptions;
};

export const ConnectivityContext =
  createContext<ConnectivityContextValue | null>(null);

/**
 * Internal hook to read default options set by the Provider.
 * Returns an empty object when called outside the Provider.
 */
export function useDefaultConnectivityOptions() {
  const context = useContext(ConnectivityContext);
  return context?.defaultOptions ?? {};
}

/**
 * Returns the ConnectivityClient from the nearest Provider.
 * Falls back to the singleton when used outside a Provider.
 */
export function useConnectivityClient() {
  const context = useContext(ConnectivityContext);
  if (context !== null) {
    return context.client;
  }
  return getConnectivityClient();
}
