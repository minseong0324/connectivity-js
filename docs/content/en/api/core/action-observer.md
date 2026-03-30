# ActionObserver

Mediator class between the `useAction` hook and `ConnectivityClient`. Not typically used directly.

## Role

- One instance per hook (`useState`, stable reference)
- `setOptions()` for in-place option updates (re-registers action without remount)
- `subscribe` and `getCurrentResult` connect directly to `useSyncExternalStore`
- `execute()` (void) / `executeAsync()` (Promise) — delegates to `ConnectivityClient` + invokes callbacks

## Signature

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

`getCurrentResult()` returns a new reference only when `pendingCount` or `lastError` actually changes. This prevents unnecessary re-renders from `useSyncExternalStore`.

## Related

- [useAction API](../react/use-action)
- [ConnectivityClient API](./connectivity-client.md)

