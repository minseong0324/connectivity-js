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

/**
 * Event emitted by a detector to report a connectivity change.
 *
 * Pass this to the `listener` function inside {@link Detector.start}.
 *
 * @example
 * listener({ status: 'online', reason: 'websocket' });
 * listener({ status: 'offline', reason: 'poll' });
 * listener({ status: 'online', reason: 'heartbeat', quality: { rttMs: 42 } });
 */
export interface DetectorEvent {
  status: ConnectivityStatus;
  /** Reason for the event (e.g. `'navigator'`, `'heartbeat'`) */
  reason: string;
  quality?: ConnectionQuality;
}

/**
 * Interface for a detector that senses connectivity status.
 *
 * Calling `start()` begins detection; the returned cleanup function stops it.
 * The cleanup is called automatically when the client is destroyed.
 *
 * @example
 * // Polling (periodic HTTP check)
 * const pollDetector: Detector = {
 *   start: (listener) => {
 *     const id = setInterval(async () => {
 *       try {
 *         await fetch('/api/health', { method: 'HEAD', cache: 'no-store' });
 *         listener({ status: 'online', reason: 'poll' });
 *       } catch {
 *         listener({ status: 'offline', reason: 'poll' });
 *       }
 *     }, 10_000);
 *     return () => clearInterval(id);
 *   },
 * };
 *
 * @example
 * // WebSocket
 * const wsDetector: Detector = {
 *   start: (listener) => {
 *     const ws = new WebSocket('wss://example.com/health');
 *     ws.onopen = () => listener({ status: 'online', reason: 'websocket' });
 *     ws.onclose = () => listener({ status: 'offline', reason: 'websocket' });
 *     return () => ws.close();
 *   },
 * };
 *
 * @example
 * // Server-Sent Events (SSE)
 * const sseDetector: Detector = {
 *   start: (listener) => {
 *     const es = new EventSource('/api/connectivity');
 *     es.onmessage = (e) => {
 *       const data = JSON.parse(e.data) as { status: ConnectivityStatus };
 *       listener({ status: data.status, reason: 'sse' });
 *     };
 *     es.onerror = () => listener({ status: 'offline', reason: 'sse' });
 *     return () => es.close();
 *   },
 * };
 *
 * @example
 * // Service Worker messages
 * const swDetector: Detector = {
 *   start: (listener) => {
 *     const handler = (e: MessageEvent) => {
 *       if (e.data?.type === 'CONNECTIVITY_UPDATE') {
 *         listener({ status: e.data.status, reason: 'service-worker' });
 *       }
 *     };
 *     navigator.serviceWorker.addEventListener('message', handler);
 *     return () => navigator.serviceWorker.removeEventListener('message', handler);
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
 * @typeParam TResult - Result type returned by the action (default: `unknown`)
 *
 * @example
 * const result = await client.execute('save', input);
 * if (result.enqueued) {
 *   console.log('queued:', result.jobId);
 * } else {
 *   console.log('executed immediately:', result.result);
 * }
 */
export type ActionRunResult<TResult = unknown> =
  | { enqueued: true; jobId: string }
  | { enqueued: false; result: TResult };

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
