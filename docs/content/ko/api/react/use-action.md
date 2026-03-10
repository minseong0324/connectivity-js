# useAction

action을 등록하고 실행하는 hook입니다.

## 시그니처

```ts
function useAction<TInput, TResult>(
  options: ActionOptionsConfig<TInput, TResult>,
  callbacks?: UseActionCallbacks<TResult>,
): {
  execute: (input: TInput) => void;
  executeAsync: (input: TInput) => Promise<
    | { enqueued: true; jobId: string }
    | { enqueued: false; result: TResult }
  >;
  pendingCount: number;
  lastError: unknown;
};
```

## Parameters

### `options`

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `actionKey` | `string` | ✅ | — | action의 고유 식별자 |
| `request` | `(input: TInput) => Promise<TResult>` | ✅ | — | 서버 요청 함수. `TInput`과 `TResult`가 여기서 추론됨 |
| `whenOffline` | `'queue' \| 'fail'` | | `'queue'` | offline 시 동작 |
| `retry` | `RetryPolicy` | | — | 재시도 정책 |
| `flushOption` | `FlushOption` | | — | flush 시 동시 실행 제어 |
| `dedupeKey` | `(input: TInput) => string` | | — | 중복 제거를 위한 엔티티 식별 함수 |
| `dedupeOnFlush` | `'keep-first' \| 'keep-last'` | | — | flush 시 dedupe 전략 |

`actionOptions()`로 추출하거나 inline으로 전달할 수 있습니다. 타입 추론은 동일합니다.

### `callbacks`

| 콜백 | 타입 | 호출 시점 |
|---|---|---|
| `onSuccess` | `(result: TResult) => void` | 즉시 실행 성공. `result`는 `request` 반환 타입에서 추론 |
| `onEnqueued` | `(jobId: string) => void` | 큐에 저장됨 (offline 또는 hasRunningDupe) |
| `onError` | `(error: unknown) => void` | 실행 실패. 에러 전파 전에 side-effect로 호출됨 |
| `onSettled` | `() => void` | 즉시 실행 시 성공/실패 후 호출. 큐에 저장된 경우 flush 완료(성공 또는 최종 실패) 후 호출 — enqueue 시점에는 호출되지 않음 |

callback은 내부적으로 매 렌더 동기화되므로, **inline 함수를 넘겨도 stale closure가 발생하지 않습니다**.

## Returns

| 필드 | 타입 | 설명 |
|---|---|---|
| `execute` | `(input: TInput) => void` | fire-and-forget 실행. 에러는 `onError`로 전달. stable 참조 |
| `executeAsync` | `(input: TInput) => Promise<...>` | awaitable 실행. 에러 시 항상 throw (`onError` 호출 후). stable 참조 |
| `pendingCount` | `number` | 이 action의 `queued` + `running` job 수 |
| `lastError` | `unknown` | 이 action의 가장 최근 `failed` job의 에러 |

### `execute` vs `executeAsync`

React Query의 `mutate` / `mutateAsync` 패턴과 동일합니다:

```ts
// fire-and-forget — 에러는 onError 콜백이 처리
execute(input);

// awaitable — discriminated union 반환, 에러 시 항상 throw
const result = await executeAsync(input);

if (result.enqueued) {
  result.jobId;  // string ✅
  result.result; // 컴파일 에러 ❌
}

if (!result.enqueued) {
  result.result; // TResult ✅
  result.jobId;  // 컴파일 에러 ❌
}
```

## Examples

### 기본 사용

```tsx
const { execute } = useAction({
  actionKey: 'save',
  request: (input: { id: string; data: string }) => api.save(input),
});

// fire-and-forget, input 타입이 자동 추론됨
execute({ id: '1', data: 'hello' });
```

### 재사용 가능한 action

```ts
// actions/save.ts
export const saveAction = actionOptions({
  actionKey: 'save',
  request: (input: { id: string; data: string }) => api.save(input),
  dedupeKey: (input) => input.id,
});

// component.tsx
const { execute } = useAction(saveAction, {
  onSuccess: (result) => toast.success('저장 완료'),
});
```

### 모든 callback 사용

```tsx
const { execute, pendingCount, lastError } = useAction(
  {
    actionKey: 'upload',
    request: (input: { file: File }) => api.upload(input),
    whenOffline: 'fail', // 반드시 online이어야 함
  },
  {
    onSuccess: (result) => {
      // result: api.upload의 반환 타입 (추론됨)
      showPreview(result.url);
    },
    onEnqueued: (jobId) => {
      // offline에서는 throw되어 호출 안 됨
      // 단, online에서 retry나 hasRunningDupe로 enqueue될 수 있음
      showQueuedNotice(jobId);
    },
    onError: (error) => {
      reportError(error);
    },
    onSettled: () => {
      hideSpinner();
    },
  },
);
```

### pendingCount 활용

```tsx
function SaveIndicator() {
  const { execute, pendingCount } = useAction(saveAction);

  return (
    <div>
      <button onClick={() => execute({ id: '1', data: 'hello' })}>저장</button>
      {pendingCount > 0 && <Spinner />}
      {pendingCount > 1 && <span>{pendingCount}개 대기 중</span>}
    </div>
  );
}
```

## Under the Hood

`useAction`은 내부적으로 `ActionObserver` 인스턴스를 생성합니다:

1. `useState(() => new ActionObserver(client, options, defaults.actions))` — hook당 1개, stable
2. `useEffect(() => observer.setOptions(options, defaults.actions))` — options와 전역 기본값 변경 시 in-place 갱신
3. `observer.setCallbacks(callbacks)` — 매 렌더 동기화 (stale closure 방지)
4. `useSyncExternalStore(observer.subscribe, observer.getCurrentResult)` — 큐 상태 구독
5. `observer.execute(input)` (void) / `observer.executeAsync(input)` (Promise) — `ConnectivityClient`에 위임 + callback 호출

`getCurrentResult()`는 반환값을 memoize합니다. `pendingCount`와 `lastError`가 실제로 변경될 때만 새 참조를 반환하여 불필요한 re-render를 방지합니다.

## 관련 문서

- [액션](../guide/actions.md) — 첫 번째 action 만들기
- [오프라인 동작](../guide/offline-behavior.md) — 실행 흐름
- [Deduplication](../guide/deduplication.md) — dedupeKey
- [actionOptions API](./action-options.md)
- [ActionObserver API](./action-observer.md)

