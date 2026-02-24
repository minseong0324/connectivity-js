# useAction

Hook for registering and executing actions.

## Signature

```ts
function useAction<TInput, TResult>(
  options: ActionOptionsConfig<TInput, TResult>,
  callbacks?: UseActionCallbacks<TResult>,
): {
  execute: (input: TInput) => Promise<
    | { enqueued: true; jobId: string }
    | { enqueued: false; result: TResult }
    | undefined
  >;
  pendingCount: number;
  lastError: unknown;
};
```

## Parameters

### `options`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `actionKey` | `string` | ✅ | — | Unique action identifier |
| `request` | `(input: TInput) => Promise<TResult>` | ✅ | — | Server request function. `TInput` and `TResult` inferred from here |
| `whenOffline` | `'queue' \| 'fail'` | | `'queue'` | Behavior when offline |
| `retry` | `RetryPolicy` | | — | Retry policy |
| `flushOption` | `FlushOption` | | — | Concurrent execution control during flush |
| `dedupeKey` | `(input: TInput) => string` | | — | Entity identifier for deduplication |
| `dedupeOnFlush` | `'keep-first' \| 'keep-last'` | | — | Flush-time dedupe strategy |

Can be extracted with `actionOptions()` or passed inline. Type inference works either way.

### `callbacks`

| Callback | Type | When |
|---|---|---|
| `onSuccess` | `(result: TResult) => void` | Immediate execution succeeded. `result` inferred from `request` return type |
| `onEnqueued` | `(jobId: string) => void` | Queued (offline or hasRunningDupe) |
| `onError` | `(error: unknown) => void` | Execution failed. When provided, error is not re-thrown |
| `onSettled` | `() => void` | Called after direct execution (success or error). When queued, called after the job flushes (success or final failure) — not at enqueue time |

Callbacks are synced on every render internally — **inline functions are safe, no stale closures**.

## Returns

| Field | Type | Description |
|---|---|---|
| `execute` | `(input: TInput) => Promise<...>` | Execute the action. Stable reference across renders |
| `pendingCount` | `number` | `queued` + `running` job count for this action |
| `lastError` | `unknown` | Error from the most recent `failed` job |

### `execute` return value

Discriminated union:

```ts
const result = await execute(input);

// 1. Queued
if (result.enqueued) {
  result.jobId;  // string ✅
  result.result; // compile error ❌
}

// 2. Immediate success
if (!result.enqueued) {
  result.result; // TResult ✅
  result.jobId;  // compile error ❌
}

// 3. onError swallowed the error
if (result === undefined) {
  // Handled by onError callback
}
```

## Examples

### Basic

```tsx
const { execute } = useAction({
  actionKey: 'save',
  request: (input: { id: string; data: string }) => api.save(input),
});

await execute({ id: '1', data: 'hello' }); // input type inferred
```

### Reusable action

```ts
// actions/save.ts
export const saveAction = actionOptions({
  actionKey: 'save',
  request: (input: { id: string; data: string }) => api.save(input),
  dedupeKey: (input) => input.id,
});

// component.tsx
const { execute } = useAction(saveAction, {
  onSuccess: (result) => toast.success('Saved'),
});
```

### All callbacks

```tsx
const { execute, pendingCount, lastError } = useAction(
  {
    actionKey: 'upload',
    request: (input: { file: File }) => api.upload(input),
    whenOffline: 'fail',
  },
  {
    onSuccess: (result) => showPreview(result.url),
    onError: (error) => reportError(error),
    onSettled: () => hideSpinner(),
  },
);
```

### pendingCount

```tsx
function SaveIndicator() {
  const { execute, pendingCount } = useAction(saveAction);

  return (
    <div>
      <button onClick={() => execute({ id: '1', data: 'hello' })}>Save</button>
      {pendingCount > 0 && <Spinner />}
    </div>
  );
}
```

## Under the Hood

`useAction` creates an `ActionObserver` instance internally:

1. `useState(() => new ActionObserver(client, options, defaults.actions))` — one per hook, stable
2. `useEffect(() => observer.setOptions(options, defaults.actions))` — in-place update on options or global defaults change
3. `observer.setCallbacks(callbacks)` — synced every render (stale closure prevention)
4. `useSyncExternalStore(observer.subscribe, observer.getCurrentResult)` — queue subscription
5. `observer.execute(input)` — delegates to `ConnectivityClient` + invokes callbacks

`getCurrentResult()` memoizes the return value. Only creates a new reference when `pendingCount` or `lastError` actually changes.

## Related

- [Actions](../guide/actions.md)
- [Offline Behavior](../guide/offline-behavior.md)
- [Deduplication](../guide/deduplication.md)
- [actionOptions API](./action-options.md)
- [ActionObserver API](./action-observer.md)

