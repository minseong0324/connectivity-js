# ActionObserver

`useAction` hook과 `ConnectivityClient` 사이의 중간 계층 class입니다. 일반적으로 직접 사용하지 않습니다.

## 역할

- hook당 1개 인스턴스 (`useState`로 생성, stable 참조)
- `setOptions()`로 options를 in-place 갱신 (re-mount 없이 action 재등록)
- `subscribe`, `getCurrentResult`를 `useSyncExternalStore`에 직접 연결
- `execute()` (void) / `executeAsync()` (Promise) — `ConnectivityClient`에 위임 + callback 호출

## 시그니처

```ts
class ActionObserver<TInput = unknown, TResult = unknown> {
  constructor(
    client: ConnectivityClient,
    options: ActionOptionsConfig<TInput, TResult>,
    defaultActionOptions?: Partial<ActionOptions>,
  );

  setOptions(options: ActionOptionsConfig<TInput, TResult>, defaults?: Partial<ActionOptions>): void;
  setCallbacks(callbacks?: UseActionCallbacks<TResult>): void;
  subscribe(callback: () => void): () => void;
  getCurrentResult(): { pendingCount: number; lastError: unknown };
  execute(input: TInput): void;
  executeAsync(input: TInput): Promise<
    | { enqueued: true; jobId: string }
    | { enqueued: false; result: TResult }
  >;
}
```

## Memoization

`getCurrentResult()`는 `pendingCount`와 `lastError`가 실제로 변경될 때만 새 참조를 반환합니다. 이로써 `useSyncExternalStore`가 불필요한 re-render를 trigger하지 않습니다.

## 관련 문서

- [useAction API](./use-action.md)
- [ConnectivityClient API](./connectivity-client.md)

