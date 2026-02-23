# Types

Connectivity에서 사용되는 모든 타입 정의입니다.

## Connectivity 상태

```ts
type ConnectivityStatus = 'online' | 'offline' | 'unknown';

interface ConnectionQuality {
  rttMs?: number;           // round-trip 시간 (ms)
  effectiveType?: string;   // '4g', '3g', '2g'
  downlink?: number;        // 예상 다운링크 속도 (Mbps)
}

interface ConnectivityState {
  status: ConnectivityStatus;
  since: number;             // Date.now()
  reason?: string;           // 변경 원인 (e.g. 'navigator', 'heartbeat')
  quality: ConnectionQuality;
}

interface ConnectivityTransition {
  from: ConnectivityStatus;
  to: ConnectivityStatus;
  duration: number;          // 이전 상태 유지 시간 (ms)
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
  concurrency?: number;   // 동시 실행 최대 수 (기본: Infinity)
  intervalMs?: number;    // batch 간 대기 시간 (기본: 0)
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

## 실행 결과

```ts
type ActionRunResult =
  | { enqueued: true; jobId: string }
  | { enqueued: false; result: unknown };
```

## Client 옵션

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

## Callback

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
  /** 모든 action에 적용할 기본 옵션 */
  actions?: Partial<ActionOptions>;
  /** Connectivity 컴포넌트의 기본값 */
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
