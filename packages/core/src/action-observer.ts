import type { ActionOptionsConfig } from './action-options';
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
    const lastError = jobs.find((j) => j.status === 'failed')?.lastError;

    if (
      this.#cachedResult.pendingCount === pendingCount &&
      this.#cachedResult.lastError === lastError
    ) {
      return this.#cachedResult;
    }

    this.#cachedResult = { pendingCount, lastError };
    return this.#cachedResult;
  }

  /**
   * Executes the action and handles callbacks.
   */
  async execute(input: TInput) {
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
      if (this.#callbacks?.onError === undefined) {
        throw error;
      }
      this.#callbacks.onError(error);
      return undefined;
    } finally {
      if (!wasEnqueued) {
        this.#callbacks?.onSettled?.();
      }
    }
  }

  #register() {
    const { dedupeKey } = this.#options;

    this.#client.registerAction(this.#options.actionKey, {
      request: (input) => this.#options.request(input as TInput),
      options: {
        whenOffline:
          this.#options.whenOffline ?? this.#defaultActionOptions?.whenOffline,
        retry: this.#options.retry ?? this.#defaultActionOptions?.retry,
        flushOption:
          this.#options.flushOption ?? this.#defaultActionOptions?.flushOption,
        dedupeKey:
          dedupeKey !== undefined
            ? (input) => dedupeKey(input as TInput)
            : undefined,
        dedupeOnFlush:
          this.#options.dedupeOnFlush ??
          this.#defaultActionOptions?.dedupeOnFlush,
      },
      onFlushSuccess: (result) =>
        this.#callbacks?.onSuccess?.(result as TResult),
      onFlushError: (error) => this.#callbacks?.onError?.(error),
      onFlushSettled: () => this.#callbacks?.onSettled?.(),
    });
  }
}
