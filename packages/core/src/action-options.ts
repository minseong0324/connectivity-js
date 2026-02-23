import type { FlushOption, RetryPolicy } from './types';

/**
 * Action configuration type passed to `actionOptions()` and `useAction()`
 *
 * @typeParam TInput  - Input type passed to the action
 * @typeParam TResult - Result type returned by the action
 */
export interface ActionOptionsConfig<TInput = unknown, TResult = unknown> {
  /** Unique key identifying the action */
  actionKey: string;
  /** Function that performs the actual async request */
  request: (input: TInput) => Promise<TResult>;
  /**
   * Behavior when offline
   * - `'queue'` — Queue the request and execute automatically when back online (default)
   * - `'fail'` — Throw an error immediately
   */
  whenOffline?: 'queue' | 'fail';
  /** Retry policy */
  retry?: RetryPolicy;
  /** Flush control options */
  flushOption?: FlushOption;
  /** Function returning a key to identify logically identical requests (used for deduplication) */
  dedupeKey?: (input: TInput) => string;
  /**
   * Deduplication strategy when multiple jobs share the same dedupeKey on flush
   * - `'keep-first'` — Keep only the first-enqueued job
   * - `'keep-last'` — Keep only the last-enqueued job
   */
  dedupeOnFlush?: 'keep-first' | 'keep-last';
}

/**
 * Identity function for defining action configuration in a type-safe way.
 *
 * Following the same pattern as TanStack Query's `queryOptions()`,
 * use this to extract a reusable action configuration into a variable.
 * Not necessary when passing the config inline to `useAction()`.
 *
 * @param config - Action configuration object
 * @returns The config passed in, returned as-is (for type inference)
 *
 * @example
 * // Extract action config to a variable
 * const saveAction = actionOptions({
 *   actionKey: 'save',
 *   request: (input: { designId: string }) => api.save(input),
 *   dedupeKey: (input) => input.designId,
 *   whenOffline: 'queue',
 * });
 *
 * @example
 * // Use in a hook
 * const { execute } = useAction(saveAction, {
 *   onSuccess: (result) => toast.success('Saved'),
 * });
 */
export function actionOptions<TInput, TResult>(
  config: ActionOptionsConfig<TInput, TResult>,
) {
  return config;
}
