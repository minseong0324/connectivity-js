/** Union type representing the network connectivity status */
export type ConnectivityStatus = 'online' | 'offline' | 'unknown';

/**
 * Network quality information
 *
 * Includes RTT measured by the heartbeat detector and effectiveType/downlink from the Network Information API.
 */
export interface ConnectionQuality {
  /** Round-trip time in milliseconds */
  rttMs?: number;
  /** Network Information API's effective connection type (e.g. `'4g'`, `'3g'`) */
  effectiveType?: string;
  /** Estimated downlink speed in Mbps */
  downlink?: number;
}

/**
 * Snapshot of the current connectivity state
 *
 * Immutable object returned by `ConnectivityClient.getState()`.
 */
export interface ConnectivityState {
  status: ConnectivityStatus;
  /** Timestamp (`Date.now()`) when the current status began */
  since: number;
  /** Reason for the status change (provided by a detector) */
  reason?: string;
  quality: ConnectionQuality;
}

/**
 * Context object carrying the before/after status and duration for a state transition
 *
 * Passed as the second argument of the `subscribe()` callback.
 */
export interface ConnectivityTransition {
  from: ConnectivityStatus;
  to: ConnectivityStatus;
  /** Duration the previous status was maintained, in milliseconds */
  duration: number;
}

/** Event emitted by a detector */
export interface DetectorEvent {
  status: ConnectivityStatus;
  /** Reason for the event (e.g. `'navigator'`, `'heartbeat'`) */
  reason: string;
  quality?: ConnectionQuality;
}

/**
 * Interface for a detector that senses connectivity status
 *
 * Calling `start()` begins detection; the returned cleanup function stops it.
 *
 * @example
 * const detector: Detector = {
 *   start: (listener) => {
 *     const id = setInterval(() => listener({ status: 'online', reason: 'poll' }), 5000);
 *     return () => clearInterval(id);
 *   },
 * };
 */
export interface Detector {
  start: (listener: (event: DetectorEvent) => void) => () => void;
}

/** Function to unsubscribe */
export type Unsubscribe = () => void;

/**
 * Automatic retry policy for failed actions
 *
 * @example
 * const policy: RetryPolicy = {
 *   maxAttempts: 3,
 *   backoffMs: (attempt) => attempt * 1_000, // 1s, 2s, 3s
 * };
 */
export interface RetryPolicy {
  /** Maximum number of attempts, including the first run */
  maxAttempts: number;
  /** Function returning the backoff delay in milliseconds based on attempt count */
  backoffMs: (attempt: number) => number;
}

/** Options controlling how the queue is flushed when returning online */
export interface FlushOption {
  /** Maximum number of jobs to run concurrently (default: `Infinity`) */
  concurrency?: number;
  /** Wait time between each batch in milliseconds (default: `0`) */
  intervalMs?: number;
}

/** Options available when registering an action */
export interface ActionOptions {
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
  dedupeKey?: (input: unknown) => string;
  /**
   * Deduplication strategy when multiple jobs share the same dedupeKey on flush
   * - `'keep-first'` — Keep only the first-enqueued job
   * - `'keep-last'` — Keep only the last-enqueued job
   */
  dedupeOnFlush?: 'keep-first' | 'keep-last';
}

/** Registered action entry managed internally by the client */
export interface RegisteredAction {
  request: (input: unknown) => Promise<unknown>;
  options: ActionOptions;
  onFlushSuccess?: (result: unknown) => void;
  onFlushError?: (error: unknown) => void;
  onFlushSettled?: () => void;
}

/** Current status of a job */
export type JobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'canceled';

/** An individual job stored in the queue */
export interface QueuedJob {
  /** Unique identifier (e.g. `'job_1_1700000000000'`) */
  id: string;
  /** Key of the action this job belongs to */
  actionKey: string;
  /** Key used for deduplication */
  dedupeKey?: string;
  /** Input value passed to the action */
  input: unknown;
  /** `Date.now()` timestamp when the job was created or last updated */
  createdAt: number;
  /** Number of attempts made so far */
  attempt: number;
  /** Scheduled time for the next run after backoff */
  nextRunAt?: number;
  status: JobStatus;
  /** Error from the last failed attempt */
  lastError?: unknown;
}

/**
 * Discriminated union returned by `execute()`
 *
 * @example
 * const result = await client.execute('save', input);
 * if (result.enqueued) {
 *   console.log('queued:', result.jobId);
 * } else {
 *   console.log('executed immediately:', result.result);
 * }
 */
export type ActionRunResult =
  | { enqueued: true; jobId: string }
  | { enqueued: false; result: unknown };

/**
 * Options passed when creating a {@link ConnectivityClient} instance
 *
 * @example
 * const options: ConnectivityClientOptions = {
 *   detectors: [browserOnlineDetector(), heartbeatDetector({ url: '/api/health' })],
 *   gracePeriodMs: 3_000,
 *   onJobError: (error, job) => Sentry.captureException(error),
 * };
 */
export interface ConnectivityClientOptions {
  /** Array of detectors used for connectivity detection */
  detectors: Detector[];
  /** Initial status (default: `'unknown'`) */
  initialStatus?: ConnectivityStatus;
  /** Grace period in milliseconds before transitioning to offline. A recovery within this window cancels the transition */
  gracePeriodMs?: number;
  /** Error handler called when a job fails during flush */
  onJobError?: (error: unknown, job: QueuedJob) => void;
  /** Default options applied to all actions */
  defaultOptions?: {
    actions?: ActionOptions;
  };
}
