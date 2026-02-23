# Types

All type definitions used in Connectivity.

## Connectivity state

```ts
type ConnectivityStatus = 'online' | 'offline' | 'unknown';

interface ConnectionQuality {
  rttMs?: number;           // round-trip time (ms)
  effectiveType?: string;   // '4g', '3g', '2g'
  downlink?: number;        // estimated downlink speed (Mbps)
}

interface ConnectivityState {
  status: ConnectivityStatus;
  since: number;             // Date.now()
  reason?: string;           // change reason (e.g. 'navigator', 'heartbeat')
  quality: ConnectionQuality;
}

interface ConnectivityTransition {
  from: ConnectivityStatus;
  to: ConnectivityStatus;
  duration: number;          // how long previous state lasted (ms)
}
```

## Detector

```ts
interface DetectorEvent {
  status: ConnectivityStatus;
  reason: string;
  quality?: ConnectionQuality;
}

interface Detector {
  start: (listener: (event: DetectorEvent) => void) => () => void;
}
```

## Action

```ts
interface RetryPolicy {
  maxAttempts: number;
  backoffMs: (attempt: number) => number;
}

interface FlushOption {
  concurrency?: number;   // max concurrent jobs (default: Infinity)
  intervalMs?: number;    // delay between batches (default: 0)
}

interface ActionOptions {
  whenOffline?: 'queue' | 'fail';
  retry?: RetryPolicy;
  flushOption?: FlushOption;
  dedupeKey?: (input: unknown) => string;
  dedupeOnFlush?: 'keep-first' | 'keep-last';
}

interface ActionOptionsConfig<TInput, TResult> {
  actionKey: string;
  request: (input: TInput) => Promise<TResult>;
  whenOffline?: 'queue' | 'fail';
  retry?: RetryPolicy;
  flushOption?: FlushOption;
  dedupeKey?: (input: TInput) => string;
  dedupeOnFlush?: 'keep-first' | 'keep-last';
}

interface RegisteredAction {
  request: (input: unknown) => Promise<unknown>;
  options: ActionOptions;
}
```

## Queue

```ts
type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

interface QueuedJob {
  id: string;
  actionKey: string;
  dedupeKey?: string;
  input: unknown;
  createdAt: number;
  attempt: number;
  nextRunAt?: number;
  status: JobStatus;
  lastError?: unknown;
}
```

## Execution result

```ts
type ActionRunResult =
  | { enqueued: true; jobId: string }
  | { enqueued: false; result: unknown };
```

## Client options

```ts
interface ConnectivityClientOptions {
  detectors: Detector[];
  initialStatus?: ConnectivityStatus;
  gracePeriodMs?: number;
  onJobError?: (error: unknown, job: QueuedJob) => void;
  defaultOptions?: {
    actions?: ActionOptions;
  };
}
```

## Callbacks

```ts
interface UseActionCallbacks<TResult> {
  onSuccess?: (result: TResult) => void;
  onEnqueued?: (jobId: string) => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
}
```

## React

```ts
interface ConnectivityProviderOptions {
  /** Global defaults for all actions */
  actions?: Partial<ActionOptions>;
  /** Defaults for Connectivity component */
  connectivity?: {
    fallback?: React.ReactNode;
    delayMs?: number;
  };
}

type ConnectivityChangeHandlers = Partial<
  Record<ConnectivityStatus, (transition: ConnectivityTransition) => void>
>;
```

## Utility

```ts
type Unsubscribe = () => void;
```
