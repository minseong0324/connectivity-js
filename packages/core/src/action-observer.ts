import { type ActionOptionsConfig, toRegisteredAction } from './action-options';
import type { ConnectivityClient } from './connectivity-client';
import type { ActionOptions } from './types';

/**
 * Type used for lifecycle callbacks in the `useAction` hook.
 */
export interface UseActionCallbacks<TResult> {
  onSuccess?: (result: TResult) => void;
  onEnqueued?: (jobId: string) => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
}

/**
 * Intermediate layer between the `useAction` hook and `ConnectivityClient`.
 *
 * - One instance per hook (created via `useState`)
 * - In-place updates via `setOptions()` (re-registers action without re-mount)
 * - `subscribe`, `getCurrentResult` → wired directly to `useSyncExternalStore`
 * - `execute` → delegated to client + callback handling
 *
 * @example
 * const [observer] = useState(() => new ActionObserver(client, options));
 * observer.setOptions(options);
 * observer.setCallbacks(callbacks);
 * useSyncExternalStore(observer.subscribe, observer.getCurrentResult, serverSnapshot);
 */
export class ActionObserver<TInput = unknown, TResult = unknown> {
  #client: ConnectivityClient;
  #options: ActionOptionsConfig<TInput, TResult>;
  #callbacks?: UseActionCallbacks<TResult>;
  #defaultActionOptions?: Partial<ActionOptions>;
  #cachedResult = { pendingCount: 0, lastError: undefined as unknown };
  #cachedFailedJobId: string | undefined = undefined;

  constructor(
    client: ConnectivityClient,
    options: ActionOptionsConfig<TInput, TResult>,
    defaultActionOptions?: Partial<ActionOptions>,
  ) {
    this.#client = client;
    this.#options = options;
    this.#defaultActionOptions = defaultActionOptions;
    this.#register();
  }

  /**
   * Updates options and defaults in-place and re-registers the action.
   * Called on every render inside `useEffect`.
   */
  setOptions(
    options: ActionOptionsConfig<TInput, TResult>,
    defaultActionOptions?: Partial<ActionOptions>,
  ) {
    this.#options = options;
    this.#defaultActionOptions = defaultActionOptions;
    this.#register();
  }

  /**
   * Updates lifecycle callbacks.
   * Called synchronously on every render to avoid stale closures.
   */
  setCallbacks(callbacks?: UseActionCallbacks<TResult>) {
    this.#callbacks = callbacks;
  }

  /**
   * Subscribes to queue changes.
   * Wrapped with `useCallback` in the hook and passed to `useSyncExternalStore`.
   */
  subscribe(callback: () => void) {
    return this.#client.subscribeQueue(callback);
  }

  /**
   * Returns the current action's pending/error state.
   * Returns the same reference when unchanged to avoid unnecessary re-renders.
   */
  getCurrentResult() {
    const jobs = this.#client.getActionQueue(this.#options.actionKey);
    const pendingCount = jobs.filter(
      (j) => j.status === 'queued' || j.status === 'running',
    ).length;
    const failedJob = jobs.find((j) => j.status === 'failed');
    const failedJobId = failedJob?.id;

    if (
      this.#cachedResult.pendingCount === pendingCount &&
      this.#cachedFailedJobId === failedJobId
    ) {
      return this.#cachedResult;
    }

    this.#cachedFailedJobId = failedJobId;
    this.#cachedResult = { pendingCount, lastError: failedJob?.lastError };
    return this.#cachedResult;
  }

  /**
   * Fire-and-forget execution. Errors are forwarded to `onError` if set;
   * otherwise silently caught. Use `executeAsync` when you need the result.
   */
  execute(input: TInput): void {
    void this.executeAsync(input).catch((error) => {
      if (this.#callbacks?.onError === undefined) {
        console.error(
          `[connectivity-js] Unhandled action error in "${this.#options.actionKey}". ` +
            'Provide an onError callback to handle this.',
          error,
        );
      }
    });
  }

  /**
   * Executes the action, invokes callbacks, and returns the result.
   * Always throws on error (after calling `onError` if provided).
   * Follows the same contract as React Query's `mutateAsync`.
   */
  async executeAsync(
    input: TInput,
  ): Promise<
    { enqueued: true; jobId: string } | { enqueued: false; result: TResult }
  > {
    let wasEnqueued = false;
    try {
      const engineResult = await this.#client.execute(
        this.#options.actionKey,
        input,
      );

      if (engineResult.enqueued) {
        wasEnqueued = true;
        this.#callbacks?.onEnqueued?.(engineResult.jobId);
        return { enqueued: true as const, jobId: engineResult.jobId };
      }

      const typedResult = engineResult.result as TResult;
      this.#callbacks?.onSuccess?.(typedResult);
      return { enqueued: false as const, result: typedResult };
    } catch (error: unknown) {
      this.#callbacks?.onError?.(error);
      throw error;
    } finally {
      if (!wasEnqueued) {
        this.#callbacks?.onSettled?.();
      }
    }
  }

  #register() {
    this.#client.registerAction(
      this.#options.actionKey,
      toRegisteredAction(this.#options, {
        defaultActionOptions: this.#defaultActionOptions,
        onFlushSuccess: (result) =>
          this.#callbacks?.onSuccess?.(result as TResult),
        onFlushError: (error) => this.#callbacks?.onError?.(error),
        onFlushSettled: () => this.#callbacks?.onSettled?.(),
      }),
    );
  }
}
