# Flush Control

Fine-grained control over how the queue is flushed when connectivity is restored.

## Why

Dozens or hundreds of jobs can accumulate offline. Sending them all simultaneously could overwhelm the server. `flushOption` controls concurrency and batch intervals.

## flushOption

```ts
const saveAction = actionOptions({
  actionKey: 'save',
  request: (input) => api.save(input),
  flushOption: {
    concurrency: 3,      // max 3 concurrent
    intervalMs: 500,      // 500ms between batches
  },
});
```

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `concurrency` | `number` | `Infinity` | Max concurrent jobs |
| `intervalMs` | `number` | `0` | Delay after each batch (ms) |

### Behavior

```
Queue: [A, B, C, D, E]  (concurrency: 2, intervalMs: 500)

Batch 1: [A, B] execute → 500ms wait
Batch 2: [C, D] execute → 500ms wait
Batch 3: [E] execute → done
```

- Batching happens within each action
- Different actions execute in parallel
- Jobs within a batch run via `Promise.allSettled`

### Global defaults + per-action

Set global defaults in `ConnectivityProvider`, override per-action:

```tsx
<ConnectivityProvider
  detectors={[...]}
  defaultOptions={{
    actions: {
      flushOption: { concurrency: 5 },
    },
  }}
>
  <App />
</ConnectivityProvider>
```

Per-action settings override global defaults. If not set, global defaults apply. Both `concurrency` and `intervalMs` follow the same rule.

## dedupeOnFlush

Dedupe strategy applied at flush time for jobs with the same `dedupeKey`.

```ts
const saveAction = actionOptions({
  actionKey: 'save',
  request: (input) => api.save(input),
  dedupeKey: (input) => input.id,
  dedupeOnFlush: 'keep-last',
});
```

| Strategy | Description |
|---|---|
| `'keep-first'` | Keep earliest enqueued job, cancel rest |
| `'keep-last'` | Keep latest enqueued job, cancel rest |

### When to use

Standard dedupe (`dedupeKey`) operates at enqueue time. But retry failures can leave multiple jobs with the same key. `dedupeOnFlush` cleans up right before flush.

### Example

```
Queue: [save:1 (v1), save:1 (v3)]  ← same key from retry failures

dedupeOnFlush: 'keep-last'
→ save:1 (v1) canceled → only save:1 (v3) executes

dedupeOnFlush: 'keep-first'
→ save:1 (v3) canceled → only save:1 (v1) executes
```

## Related

- [Offline Behavior](../guide/offline-behavior.md)
- [Deduplication](../guide/deduplication.md)
- [Default Options](./default-options.md)

