# ConnectivityClient

connectivity 상태를 감지하고, offline action 큐잉·retry·dedupe를 관리하는 singleton client입니다.

## 인스턴스 생성

```ts
import { ConnectivityClient, getConnectivityClient } from '@connectivity-js/core';

// 방법 1: static 메서드
const client = ConnectivityClient.getInstance(options);

// 방법 2: shorthand 함수 (동일)
const client = getConnectivityClient(options);
```

`options`는 최초 호출에서만 적용됩니다. 이후 호출에서는 무시됩니다.

### ConnectivityClientOptions

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `detectors` | `Detector[]` | (필수) | connectivity 감지 전략 |
| `initialStatus` | `ConnectivityStatus` | `'unknown'` | 초기 상태 |
| `gracePeriodMs` | `number` | `0` | offline 전환 유예 기간 (ms) |
| `onJobError` | `(error, job) => void` | — | flush 중 job 최종 실패 시 호출 |
| `defaultOptions.actions` | `ActionOptions` | — | 전체 action 기본 옵션 |

## Methods

### `start()`

등록된 detector를 활성화합니다. `ConnectivityProvider` 사용 시 자동 호출됩니다. 중복 호출은 무시됩니다.

```ts
client.start();
```

### `destroy()`

모든 타이머, detector, listener를 정리합니다. `ConnectivityProvider` unmount 시 자동 호출됩니다.

```ts
client.destroy();
```

### `getState()`

현재 connectivity 상태의 immutable snapshot을 반환합니다.

```ts
const state = client.getState();
// { status: 'online', since: 1700000000000, quality: { rttMs: 42 } }
```

### `subscribe(listener)`

connectivity 상태 변경을 구독합니다.

```ts
const unsubscribe = client.subscribe((state, transition) => {
  console.log(state.status, transition?.from, '→', transition?.to);
});
```

| 파라미터 | 타입 |
|---|---|
| `listener` | `(state: ConnectivityState, transition?: ConnectivityTransition) => void` |
| 반환값 | `() => void` (unsubscribe) |

### `registerAction(actionKey, action)`

action을 client에 등록합니다. 동일한 key로 재등록하면 덮어씁니다.

```ts
client.registerAction('save', {
  request: (input) => api.save(input),
  options: {
    whenOffline: 'queue',
    retry: { maxAttempts: 3, backoffMs: (n) => n * 1_000 },
    dedupeKey: (input) => (input as { id: string }).id,
  },
});
```

### `execute(actionKey, input)`

등록된 action을 실행합니다.

```ts
const result = await client.execute('save', { id: '1', data: 'hello' });
if (result.enqueued) {
  console.log(result.jobId);
} else {
  console.log(result.result);
}
```

| 파라미터 | 타입 |
|---|---|
| `actionKey` | `string` |
| `input` | `unknown` |
| 반환값 | `Promise<{ enqueued: true; jobId: string } \| { enqueued: false; result: unknown }>` |

### `getQueue()`

전체 job 큐의 snapshot을 반환합니다.

```ts
const jobs = client.getQueue();
```

### `getActionQueue(actionKey)`

특정 action의 job만 반환합니다. 변경이 없으면 동일한 참조를 유지합니다.

```ts
const saveJobs = client.getActionQueue('save');
```

### `subscribeQueue(listener)`

job 큐 변경을 구독합니다.

```ts
const unsubscribe = client.subscribeQueue((jobs) => {
  console.log('queued:', jobs.filter(j => j.status === 'queued').length);
});
```

### `retry(jobId)`

실패하거나 대기 중인 job을 재시도합니다.

```ts
await client.retry('job_1_1700000000000');
```

### `cancel(jobId)`

큐에 있는 job을 취소합니다.

```ts
client.cancel('job_1_1700000000000');
```

### `flush(options?)`

대기 중인 job을 수동으로 flush합니다.

```ts
await client.flush();
await client.flush({ onlyActionKey: 'save' });
```

### `resetInstance()` (static)

singleton 인스턴스를 파괴합니다. **테스트 환경 전용**입니다.

```ts
afterEach(() => {
  ConnectivityClient.resetInstance();
});
```

## 관련 문서

- [액션](../guide/actions.md)
- [ConnectivityProvider API](./connectivity-provider.md)
- [테스트 가이드](../advanced/testing.md)

