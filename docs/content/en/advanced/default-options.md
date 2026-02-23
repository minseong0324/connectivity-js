# Default Options

Setting global defaults for all hooks and components via `ConnectivityProvider`.

## Configuration

```tsx
<ConnectivityProvider
  detectors={[...]}
  defaultOptions={{
    actions: {
      whenOffline: 'queue',
      retry: { maxAttempts: 3, backoffMs: (n) => n * 1_000 },
      flushOption: { concurrency: 5 },
    },
    connectivity: {
      fallback: <GlobalOfflineScreen />,
      delayMs: 2_000,
    },
  }}
>
  <App />
</ConnectivityProvider>
```

## defaultOptions.actions

Global action defaults applied to all `useAction` calls.

| Field | Type | Description |
|---|---|---|
| `whenOffline` | `'queue' \| 'fail'` | Default offline behavior |
| `retry` | `RetryPolicy` | Default retry policy |
| `flushOption` | `FlushOption` | Default flush control |
| `dedupeOnFlush` | `'keep-first' \| 'keep-last'` | Default flush-time dedupe strategy |

### Merge rules

Per-action settings **override** global defaults:

```ts
// Global: retry maxAttempts=3
// Per-action: retry maxAttempts=5
// → Result: maxAttempts=5 (per-action wins)

// Global: whenOffline='queue'
// Per-action: not set
// → Result: whenOffline='queue' (global default applied)
```

`flushOption` follows the same rule. Both `concurrency` and `intervalMs` use per-action values when set, falling back to global defaults otherwise.

### Example: retry for all actions

```tsx
<ConnectivityProvider
  detectors={[...]}
  defaultOptions={{
    actions: {
      retry: { maxAttempts: 3, backoffMs: (n) => n * 1_000 },
    },
  }}
>
  <App />
</ConnectivityProvider>

// No retry needed per-action — global default auto-applies
const { execute } = useAction({
  actionKey: 'save',
  request: (input) => api.save(input),
});
```

## defaultOptions.connectivity

Defaults for the `<Connectivity>` component.

| Field | Type | Description |
|---|---|---|
| `fallback` | `ReactNode` | Default offline fallback UI |
| `delayMs` | `number` | Default offline transition delay |

### Example

```tsx
<ConnectivityProvider
  detectors={[...]}
  defaultOptions={{
    connectivity: {
      fallback: <GlobalOffline />,
      delayMs: 2_000,
    },
  }}
>
  <Connectivity><App /></Connectivity>
  <Connectivity fallback={<Custom />} delayMs={0}><Critical /></Connectivity>
</ConnectivityProvider>
```

## Related

- [ConnectivityProvider API](../api/react/connectivity-provider.md)
- [Flush Control](./flush-control.md)
- [Retry](./retry.md)

