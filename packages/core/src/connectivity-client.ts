import type { ActionOptionsConfig } from './action-options';
import {
  DEFAULT_BACKOFF_MS,
  delay,
  SUCCEEDED_JOB_CLEANUP_DELAY_MS,
} from './engine-utils';
import type {
  ActionOptions,
  ActionRunResult,
  ConnectionQuality,
  ConnectivityClientOptions,
  ConnectivityState,
  ConnectivityTransition,
  Detector,
  QueuedJob,
  RegisteredAction,
  Unsubscribe,
} from './types';

const DEFAULT_QUALITY: ConnectionQuality = {};
const EMPTY_JOBS: QueuedJob[] = [];

/**
 * Singleton client that detects network connectivity status and manages offline action queuing, retry, and deduplication.
 *
 * Follows the same pattern as TanStack Query's `QueryClient` — a single instance is shared across the app.
 * Use `getConnectivityClient()` to obtain the instance and `start()` to activate detectors.
 *
 * @example
 * // 1. Create instance and start
 * const client = getConnectivityClient({
 *   detectors: [browserOnlineDetector(), heartbeatDetector({ url: '/api/health' })],
 *   gracePeriodMs: 3_000,
 * });
 * client.start();
 *
 * @example
 * // 2. Register and execute actions
 * client.registerAction('save', {
 *   request: (input) => api.save(input),
 *   options: { whenOffline: 'queue', dedupeKey: (input) => input.id },
 * });
 * const result = await client.execute('save', { id: '1', data: 'hello' });
 *
 * @example
 * // 3. Subscribe to state
 * client.subscribe((state, transition) => {
 *   console.log(state.status); // 'online' | 'offline' | 'unknown'
 * });
 */
export class ConnectivityClient {
  static #instance: ConnectivityClient | null = null;

  #detectors: Detector[];
  #detectorCleanups: Array<() => void> = [];
  #gracePeriodMs: number;
  #pendingGraceTimerId: ReturnType<typeof setTimeout> | null = null;
  #pendingGraceReason: string | undefined = undefined;
  #onJobError?: (error: unknown, job: QueuedJob) => void;
  #defaultActionOptions?: ActionOptions;

  #state: ConnectivityState;
  #stateSnapshot: ConnectivityState;
  #stateListeners = new Set<
    (s: ConnectivityState, t?: ConnectivityTransition) => void
  >();

  #jobs = new Map<string, QueuedJob>();
  #queueListeners = new Set<() => void>();
  #queueSnapshot: QueuedJob[] = [];
  #actionSnapshots = new Map<string, QueuedJob[]>();

  #actions = new Map<string, RegisteredAction>();
  #timerIds = new Set<ReturnType<typeof setTimeout>>();
  #jobIdCounter = 0;
  #started = false;
  #destroyed = false;

  private constructor(options?: ConnectivityClientOptions) {
    const initialStatus = options?.initialStatus ?? 'unknown';
    this.#state = {
      status: initialStatus,
      since: Date.now(),
      quality: DEFAULT_QUALITY,
    };
    this.#stateSnapshot = { ...this.#state };
    this.#detectors = options?.detectors ?? [];
    this.#gracePeriodMs = options?.gracePeriodMs ?? 0;
    this.#onJobError = options?.onJobError;
    this.#defaultActionOptions = options?.defaultOptions?.actions;
  }

  /**
   * Returns the singleton instance.
   * On first call, creates the instance with `options`; subsequent calls return the existing instance.
   *
   * @param options - Client configuration applied on first creation
   *
   * @example
   * const client = ConnectivityClient.getInstance({
   *   detectors: [browserOnlineDetector()],
   * });
   */
  static getInstance(options?: ConnectivityClientOptions) {
    if (ConnectivityClient.#instance === null) {
      ConnectivityClient.#instance = new ConnectivityClient(options);
    }
    return ConnectivityClient.#instance;
  }

  /**
   * Destroys the singleton instance and resets it.
   * Used for isolation in test environments.
   *
   * @example
   * afterEach(() => {
   *   ConnectivityClient.resetInstance();
   * });
   */
  static resetInstance() {
    if (ConnectivityClient.#instance !== null) {
      ConnectivityClient.#instance.destroy();
      ConnectivityClient.#instance = null;
    }
  }

  // ─── Timer ────────────────────────────────

  #scheduleTimer(fn: () => void, delayMs: number) {
    const id = setTimeout(() => {
      this.#timerIds.delete(id);
      fn();
    }, delayMs);
    this.#timerIds.add(id);
    return id;
  }

  #clearAllTimers() {
    for (const id of this.#timerIds) {
      clearTimeout(id);
    }
    this.#timerIds.clear();
  }

  // ─── Lifecycle ────────────────────────────

  /**
   * Activates registered detectors and starts connectivity detection.
   * Called automatically when using `ConnectivityProvider`; no need to call directly.
   *
   * @example
   * const client = getConnectivityClient({ detectors: [browserOnlineDetector()] });
   * client.start();
   */
  start() {
    if (this.#started) {
      return;
    }
    this.#destroyed = false;
    this.#started = true;
    for (const detector of this.#detectors) {
      const cleanup = detector.start((event) => {
        this.#updateStatus(event.status, event.reason, event.quality);
      });
      this.#detectorCleanups.push(cleanup);
    }
  }

  /**
   * Cleans up all timers, detectors, and listeners, and deactivates the instance.
   * Called automatically when `ConnectivityProvider` unmounts.
   *
   * @example
   * client.destroy();
   */
  destroy() {
    this.#destroyed = true;
    this.#started = false;
    this.#cancelGracePeriod();
    this.#clearAllTimers();
    for (const cleanup of this.#detectorCleanups) {
      cleanup();
    }
    this.#detectorCleanups.length = 0;
    this.#stateListeners.clear();
    this.#queueListeners.clear();
    this.#jobs.clear();
    this.#actions.clear();
    this.#actionSnapshots.clear();
    this.#queueSnapshot = [];
  }

  // ─── State ────────────────────────────────

  /**
   * Returns an immutable snapshot of the current connectivity state.
   * Keeps the same reference when unchanged for compatibility with `useSyncExternalStore`.
   *
   * @example
   * const state = client.getState();
   * console.log(state.status); // 'online' | 'offline' | 'unknown'
   */
  getState() {
    return this.#stateSnapshot;
  }

  /**
   * Subscribes to connectivity state changes.
   * A `transition` object is passed when the status changes.
   *
   * @param listener - Callback invoked on state change
   * @returns Unsubscribe function
   *
   * @example
   * const unsubscribe = client.subscribe((state, transition) => {
   *   if (transition?.to === 'offline') {
   *     showOfflineBanner();
   *   }
   * });
   */
  subscribe(
    listener: (s: ConnectivityState, t?: ConnectivityTransition) => void,
  ): Unsubscribe {
    this.#stateListeners.add(listener);
    return () => {
      this.#stateListeners.delete(listener);
    };
  }

  #notifyState(transition?: ConnectivityTransition) {
    this.#stateSnapshot = this.#state;
    for (const listener of this.#stateListeners) {
      listener(this.#stateSnapshot, transition);
    }
  }

  #commitStatusChange(
    newStatus: ConnectivityState['status'],
    reason?: string,
    quality?: ConnectionQuality,
  ) {
    const now = Date.now();
    const transition: ConnectivityTransition = {
      from: this.#state.status,
      to: newStatus,
      duration: now - this.#state.since,
    };
    this.#state = {
      status: newStatus,
      since: now,
      reason,
      quality: quality ?? DEFAULT_QUALITY,
    };
    this.#notifyState(transition);
    if (newStatus === 'online') {
      void this.#flushQueue();
    }
  }

  #cancelGracePeriod() {
    if (this.#pendingGraceTimerId === null) {
      return;
    }
    clearTimeout(this.#pendingGraceTimerId);
    this.#pendingGraceTimerId = null;
    this.#pendingGraceReason = undefined;
  }

  #updateStatus(
    newStatus: ConnectivityState['status'],
    reason?: string,
    quality?: ConnectionQuality,
  ) {
    if (quality !== undefined) {
      this.#state = { ...this.#state, quality };
    }
    if (newStatus === 'online') {
      this.#cancelGracePeriod();
    }
    if (this.#state.status === newStatus) {
      if (quality !== undefined) {
        this.#notifyState();
      }
      return;
    }
    if (this.#gracePeriodMs > 0 && newStatus !== 'online') {
      this.#pendingGraceReason = reason;
      if (this.#pendingGraceTimerId !== null) {
        return;
      }
      this.#pendingGraceTimerId = setTimeout(() => {
        const latestReason = this.#pendingGraceReason;
        this.#pendingGraceReason = undefined;
        this.#pendingGraceTimerId = null;
        if (this.#state.status !== newStatus) {
          this.#commitStatusChange(
            newStatus,
            latestReason,
            this.#state.quality,
          );
        }
      }, this.#gracePeriodMs);
      return;
    }
    this.#cancelGracePeriod();
    this.#commitStatusChange(newStatus, reason, quality);
  }

  // ─── Queue ────────────────────────────────

  /**
   * Returns an immutable snapshot of the full job queue.
   *
   * @example
   * const jobs = client.getQueue();
   * const pending = jobs.filter(j => j.status === 'queued');
   */
  getQueue() {
    return this.#queueSnapshot;
  }

  /**
   * Filters and returns only jobs for a specific action.
   * Keeps the same reference when the action has no changes to avoid unnecessary re-renders.
   *
   * @param actionKey - Unique key of the action to filter
   *
   * @example
   * const saveJobs = client.getActionQueue('save');
   */
  getActionQueue(actionKey: string) {
    return this.#actionSnapshots.get(actionKey) ?? EMPTY_JOBS;
  }

  /**
   * Subscribes to job queue changes.
   * Call `getQueue()` or `getActionQueue()` when the updated job list is needed.
   *
   * @param listener - Callback invoked on queue change
   * @returns Unsubscribe function
   *
   * @example
   * const unsubscribe = client.subscribeQueue(() => {
   *   const jobs = client.getQueue();
   *   updateBadge(jobs.filter(j => j.status === 'queued').length);
   * });
   */
  subscribeQueue(listener: () => void) {
    this.#queueListeners.add(listener);
    return () => {
      this.#queueListeners.delete(listener);
    };
  }

  #notifyQueue() {
    this.#queueSnapshot = Array.from(this.#jobs.values());
    const seen = new Set<string>();
    for (const job of this.#queueSnapshot) {
      seen.add(job.actionKey);
    }

    for (const actionKey of seen) {
      const newJobs = this.#queueSnapshot.filter(
        (j) => j.actionKey === actionKey,
      );
      const prev = this.#actionSnapshots.get(actionKey);
      if (prev === undefined || !this.#shallowEqual(prev, newJobs)) {
        this.#actionSnapshots.set(actionKey, newJobs);
      }
    }
    for (const key of this.#actionSnapshots.keys()) {
      if (!seen.has(key)) {
        this.#actionSnapshots.delete(key);
      }
    }
    for (const listener of this.#queueListeners) {
      listener();
    }
  }

  #shallowEqual(a: QueuedJob[], b: QueuedJob[]) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  #queueGet(id: string) {
    return this.#jobs.get(id);
  }
  #queuePut(job: QueuedJob) {
    this.#jobs.set(job.id, job);
  }
  #queuePatch(id: string, partial: Partial<QueuedJob>) {
    const existing = this.#jobs.get(id);
    if (existing === undefined) {
      return;
    }
    this.#jobs.set(id, { ...existing, ...partial });
  }
  #queueRemove(id: string) {
    this.#jobs.delete(id);
  }
  #queueList() {
    return Array.from(this.#jobs.values());
  }
  #generateJobId() {
    return `job_${++this.#jobIdCounter}_${Date.now()}`;
  }

  // ─── Action ───────────────────────────────

  /**
   * Registers an action with the client.
   * Re-registering with the same `actionKey` overwrites the existing action.
   *
   * @param actionKey - Unique key of the action
   * @param action - Action definition including request function and options
   *
   * @example
   * client.registerAction('save', {
   *   request: (input) => api.save(input),
   *   options: {
   *     whenOffline: 'queue',
   *     retry: { maxAttempts: 3, backoffMs: (n) => n * 1_000 },
   *   },
   * });
   */
  registerAction(actionKey: string, action: RegisteredAction) {
    this.#actions.set(actionKey, action);
  }

  /**
   * Executes a registered action.
   *
   * **Overload 1 — Type-safe with `ActionOptionsConfig`:**
   * Pass an `actionOptions()` config to get fully inferred `TInput` and `TResult`.
   * Auto-registers the action if it has not been registered yet.
   *
   * **Overload 2 — String key (backward compatible):**
   * Pass a previously registered action key. Result type is `unknown`.
   *
   * - **online**: Executes immediately and returns the result (`{ enqueued: false, result }`)
   * - **offline + `whenOffline: 'queue'`**: Queues the request (`{ enqueued: true, jobId }`)
   * - **offline + `whenOffline: 'fail'`**: Throws an error immediately
   *
   * @throws When action is not registered or when executing offline with `whenOffline: 'fail'`
   *
   * @example
   * // Type-safe with actionOptions
   * const saveAction = actionOptions({
   *   actionKey: 'save',
   *   request: (input: { id: string; data: string }) => api.save(input),
   * });
   * const result = await client.execute(saveAction, { id: '1', data: 'hello' });
   * if (!result.enqueued) {
   *   result.result; // fully typed as the return of api.save()
   * }
   *
   * @example
   * // String key (backward compatible)
   * const result = await client.execute('save', { id: '1', data: 'hello' });
   */
  async execute<TInput, TResult>(
    config: ActionOptionsConfig<TInput, TResult>,
    input: TInput,
  ): Promise<ActionRunResult<TResult>>;
  async execute(actionKey: string, input: unknown): Promise<ActionRunResult>;
  async execute<TInput = unknown, TResult = unknown>(
    configOrKey: string | ActionOptionsConfig<TInput, TResult>,
    input: TInput,
  ): Promise<ActionRunResult<TResult>> {
    const actionKey =
      typeof configOrKey === 'string' ? configOrKey : configOrKey.actionKey;

    // Auto-register when called with config and the action is not yet registered.
    // If already registered (e.g. by ActionObserver with flush callbacks), the
    // existing registration is preserved so that flush callbacks are not lost.
    if (typeof configOrKey !== 'string' && !this.#actions.has(actionKey)) {
      this.#registerFromConfig(configOrKey);
    }

    const action = this.#actions.get(actionKey);
    if (action === undefined) {
      throw new Error(
        `[ConnectivityClient] Action "${actionKey}" is not registered.`,
      );
    }

    const mergedOptions = {
      whenOffline:
        action.options.whenOffline ??
        this.#defaultActionOptions?.whenOffline ??
        'queue',
      retry: action.options.retry ?? this.#defaultActionOptions?.retry,
    };

    // Only throw on confirmed offline — unknown is uncertain, so queue instead of throw
    // Intentionally differs from <Connectivity>'s isOnline(status !== 'offline'):
    //   UI is optimistic (unknown → children), Data is conservative (unknown → queue)
    const isConfirmedOffline = this.#state.status === 'offline';
    const isConfirmedOnline = this.#state.status === 'online';

    if (isConfirmedOffline && mergedOptions.whenOffline === 'fail') {
      throw new Error(
        `[ConnectivityClient] Action "${actionKey}" failed: offline and whenOffline='fail'`,
      );
    }

    const jobId = this.#enqueueJob(actionKey, input);
    const job = this.#queueGet(jobId);

    // Immediate execution only when confirmed online — if unknown, queue and flush after detector emits
    if (!isConfirmedOnline) {
      return { enqueued: true as const, jobId };
    }

    const hasRunningDupe =
      job?.dedupeKey !== undefined &&
      this.#queueList().some(
        (j) =>
          j.id !== jobId &&
          j.actionKey === actionKey &&
          j.dedupeKey === job.dedupeKey &&
          j.status === 'running',
      );
    if (hasRunningDupe) {
      return { enqueued: true as const, jobId };
    }

    this.#queuePatch(jobId, {
      status: 'running',
      attempt: (job?.attempt ?? 0) + 1,
    });
    this.#notifyQueue();

    try {
      // Config path: call config.request directly — TResult is fully inferred,
      // no type assertion needed. The Map is not involved in the request call or
      // result typing; however, mergedOptions (whenOffline, retry) still comes from
      // the Map's registered action.options (set above via auto-register or prior
      // registerAction call).
      // String path: call action.request from Map — result is unknown,
      // TResult defaults to unknown so ActionRunResult<unknown> is returned.
      if (typeof configOrKey !== 'string') {
        const result = await configOrKey.request(input);
        this.#onImmediateSuccess(jobId);
        return { enqueued: false as const, result };
      }

      const result = await action.request(input);
      this.#onImmediateSuccess(jobId);
      return { enqueued: false as const, result: result as TResult };
    } catch (error: unknown) {
      return this.#resolveExecuteFailure({
        error,
        jobId,
        actionKey,
        job,
        mergedOptions,
      });
    }
  }

  #onImmediateSuccess(jobId: string) {
    this.#queuePatch(jobId, { status: 'succeeded' });
    this.#notifyQueue();
    this.#scheduleTimer(() => {
      this.#queueRemove(jobId);
      this.#notifyQueue();
    }, SUCCEEDED_JOB_CLEANUP_DELAY_MS);
    void this.#flushQueue();
  }

  #registerFromConfig<TInput, TResult>(
    config: ActionOptionsConfig<TInput, TResult>,
  ) {
    const { dedupeKey } = config;
    this.registerAction(config.actionKey, {
      request: (input) => config.request(input as TInput),
      options: {
        whenOffline: config.whenOffline,
        retry: config.retry,
        flushOption: config.flushOption,
        dedupeKey:
          dedupeKey !== undefined
            ? (input) => dedupeKey(input as TInput)
            : undefined,
        dedupeOnFlush: config.dedupeOnFlush,
      },
    });
  }

  #enqueueJob(actionKey: string, input: unknown) {
    const action = this.#actions.get(actionKey);
    const dedupeKey = action?.options.dedupeKey?.(input);

    if (dedupeKey !== undefined) {
      const existing = this.#queueList().find(
        (j) =>
          j.actionKey === actionKey &&
          j.dedupeKey === dedupeKey &&
          j.status === 'queued',
      );
      if (existing !== undefined) {
        this.#queuePatch(existing.id, {
          input,
          attempt: 0,
          createdAt: Date.now(),
          nextRunAt: undefined,
        });
        this.#notifyQueue();
        return existing.id;
      }
    }

    const job: QueuedJob = {
      id: this.#generateJobId(),
      actionKey,
      dedupeKey,
      input,
      createdAt: Date.now(),
      attempt: 0,
      status: 'queued',
    };
    this.#queuePut(job);
    this.#notifyQueue();
    return job.id;
  }

  #resolveExecuteFailure({
    error,
    jobId,
    actionKey,
    job,
    mergedOptions,
  }: {
    error: unknown;
    jobId: string;
    actionKey: string;
    job: QueuedJob | undefined;
    mergedOptions: { retry?: ActionOptions['retry'] };
  }) {
    const maxAttempts = mergedOptions.retry?.maxAttempts ?? 1;

    if (maxAttempts <= 1) {
      this.#queuePatch(jobId, {
        status: 'failed',
        lastError: error,
      });
      this.#notifyQueue();
      void this.#flushQueue();
      throw error;
    }

    const dedupeKey = job?.dedupeKey;
    const hasNewerQueuedJob =
      dedupeKey !== undefined &&
      this.#queueList().some(
        (j) =>
          j.id !== jobId &&
          j.actionKey === actionKey &&
          j.dedupeKey === dedupeKey &&
          j.status === 'queued',
      );

    if (hasNewerQueuedJob) {
      this.#queuePatch(jobId, {
        status: 'canceled',
        lastError: error,
      });
      this.#notifyQueue();
      void this.#flushQueue();
      return { enqueued: true as const, jobId };
    }

    const currentAttempt = (job?.attempt ?? 0) + 1;
    const backoffMs =
      mergedOptions.retry?.backoffMs(currentAttempt) ?? DEFAULT_BACKOFF_MS;
    this.#queuePatch(jobId, {
      status: 'queued',
      lastError: error,
      nextRunAt: Date.now() + backoffMs,
    });
    this.#notifyQueue();
    this.#scheduleRetry(jobId, backoffMs);
    void this.#flushQueue();
    return { enqueued: true as const, jobId };
  }

  // ─── Queue Control ───────────────────────────

  /**
   * Retries a failed or pending job.
   * Executes immediately when online; keeps in queue when offline.
   *
   * @param jobId - ID of the job to retry
   *
   * @example
   * await client.retry('job_1_1700000000000');
   */
  async retry(jobId: string) {
    const job = this.#queueGet(jobId);
    if (
      job === undefined ||
      (job.status !== 'failed' && job.status !== 'queued')
    ) {
      return;
    }
    this.#queuePatch(jobId, { status: 'queued', nextRunAt: undefined });
    this.#notifyQueue();
    if (this.#state.status === 'online') {
      const updatedJob = this.#queueGet(jobId);
      if (updatedJob !== undefined) {
        await this.#processJob(updatedJob);
      }
    }
  }

  /**
   * Cancels a job in the queue.
   *
   * @param jobId - ID of the job to cancel
   *
   * @example
   * client.cancel('job_1_1700000000000');
   */
  cancel(jobId: string) {
    this.#queuePatch(jobId, { status: 'canceled' });
    this.#notifyQueue();
  }

  /**
   * Manually flushes pending jobs.
   * When `onlyActionKey` is specified, only jobs for that action are processed.
   *
   * @param options - Flush options
   * @param options.onlyActionKey - Action key when flushing only a specific action
   *
   * @example
   * // Flush entire queue
   * await client.flush();
   *
   * @example
   * // Flush only a specific action
   * await client.flush({ onlyActionKey: 'save' });
   */
  async flush(options?: { onlyActionKey?: string }) {
    await this.#flushQueue(options?.onlyActionKey);
  }

  // ─── Job Processing ───────────────────────

  async #processJob(job: QueuedJob) {
    if (this.#destroyed) {
      return;
    }
    const action = this.#actions.get(job.actionKey);
    if (action === undefined) {
      return;
    }

    this.#queuePatch(job.id, { status: 'running', attempt: job.attempt + 1 });
    this.#notifyQueue();

    try {
      const result = await action.request(job.input);
      this.#queuePatch(job.id, { status: 'succeeded' });
      this.#notifyQueue();
      this.#scheduleTimer(() => {
        this.#queueRemove(job.id);
        this.#notifyQueue();
      }, SUCCEEDED_JOB_CLEANUP_DELAY_MS);
      action.onFlushSuccess?.(result);
      action.onFlushSettled?.();
    } catch (error: unknown) {
      const maxAttempts = action.options.retry?.maxAttempts ?? 1;
      const currentAttempt = job.attempt + 1;

      if (currentAttempt >= maxAttempts) {
        this.#queuePatch(job.id, {
          status: 'failed',
          lastError: error,
        });
        this.#notifyQueue();
        const latestJob = this.#queueGet(job.id);
        if (latestJob) {
          this.#onJobError?.(error, latestJob);
        }
        action.onFlushError?.(error);
        action.onFlushSettled?.();
        return;
      }

      const backoffMs =
        action.options.retry?.backoffMs(currentAttempt) ?? DEFAULT_BACKOFF_MS;
      this.#queuePatch(job.id, {
        status: 'queued',
        lastError: error,
        nextRunAt: Date.now() + backoffMs,
      });
      this.#notifyQueue();
      this.#scheduleRetry(job.id, backoffMs);
    }
  }

  #scheduleRetry(jobId: string, delayMs: number) {
    this.#scheduleTimer(() => {
      if (this.#state.status !== 'online') {
        return;
      }
      const updatedJob = this.#queueGet(jobId);
      if (updatedJob !== undefined && updatedJob.status === 'queued') {
        void this.#processJob(updatedJob);
      }
    }, delayMs);
  }

  #getPendingJobs(onlyActionKey?: string) {
    const now = Date.now();
    return this.#queueList()
      .filter((j) => {
        if (j.status !== 'queued') {
          return false;
        }
        if (onlyActionKey !== undefined && j.actionKey !== onlyActionKey) {
          return false;
        }
        if (j.nextRunAt !== undefined && j.nextRunAt > now) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  #dedupeBeforeFlush(onlyActionKey?: string) {
    const pendingJobs = this.#getPendingJobs(onlyActionKey);
    const groups = new Map<string, QueuedJob[]>();

    for (const job of pendingJobs) {
      if (job.dedupeKey === undefined) {
        continue;
      }
      const compositeKey = `${job.actionKey}:${job.dedupeKey}`;
      const group = groups.get(compositeKey) ?? [];
      group.push(job);
      groups.set(compositeKey, group);
    }

    let hasCanceled = false;
    for (const [, group] of groups) {
      if (group.length <= 1) {
        continue;
      }
      const firstJob = group[0];
      if (!firstJob) {
        continue;
      }
      const action = this.#actions.get(firstJob.actionKey);
      const strategy = action?.options.dedupeOnFlush;
      if (strategy === undefined) {
        continue;
      }
      const toCancel =
        strategy === 'keep-first' ? group.slice(1) : group.slice(0, -1);
      for (const job of toCancel) {
        this.#queuePatch(job.id, { status: 'canceled' });
        hasCanceled = true;
      }
    }
    if (hasCanceled) {
      this.#notifyQueue();
    }
  }

  #resolveFlushOption(actionKey: string) {
    const action = this.#actions.get(actionKey);
    const actionOpt = action?.options.flushOption;
    const defaultOpt = this.#defaultActionOptions?.flushOption;
    return {
      concurrency:
        actionOpt?.concurrency ?? defaultOpt?.concurrency ?? Infinity,
      intervalMs: actionOpt?.intervalMs ?? defaultOpt?.intervalMs ?? 0,
    };
  }

  async #executeActionGroup(actionKey: string) {
    const { concurrency, intervalMs } = this.#resolveFlushOption(actionKey);
    while (true) {
      if (this.#destroyed || this.#state.status !== 'online') {
        return;
      }
      const jobs = this.#getPendingJobs().filter(
        (j) => j.actionKey === actionKey,
      );
      if (jobs.length === 0) {
        return;
      }
      const chunk = jobs.slice(0, concurrency);
      await Promise.allSettled(chunk.map((job) => this.#processJob(job)));
      const remaining = this.#getPendingJobs().filter(
        (j) => j.actionKey === actionKey,
      );
      if (remaining.length === 0) {
        return;
      }
      if (intervalMs > 0) {
        await delay(intervalMs);
      }
    }
  }

  async #flushQueue(onlyActionKey?: string) {
    const processedActionKeys = new Set<string>();
    while (true) {
      if (this.#destroyed) {
        return;
      }
      this.#dedupeBeforeFlush(onlyActionKey);
      const pendingJobs = this.#getPendingJobs(onlyActionKey);
      const actionKeys = new Set(pendingJobs.map((j) => j.actionKey));
      const newActionKeys = Array.from(actionKeys).filter(
        (k) => !processedActionKeys.has(k),
      );
      if (newActionKeys.length === 0) {
        break;
      }
      for (const key of newActionKeys) {
        processedActionKeys.add(key);
      }
      await Promise.allSettled(
        newActionKeys.map((ak) => this.#executeActionGroup(ak)),
      );
    }
  }
}

/**
 * Shorthand function that returns the {@link ConnectivityClient} singleton instance.
 *
 * @param options - Client configuration applied on first creation (ignored on subsequent calls)
 *
 * @example
 * // Initial setup
 * const client = getConnectivityClient({
 *   detectors: [browserOnlineDetector()],
 *   gracePeriodMs: 3_000,
 * });
 *
 * @example
 * // Subsequent access
 * const client = getConnectivityClient();
 * const state = client.getState();
 */
export function getConnectivityClient(options?: ConnectivityClientOptions) {
  return ConnectivityClient.getInstance(options);
}
