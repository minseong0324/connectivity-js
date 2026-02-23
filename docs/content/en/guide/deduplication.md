---
title: Deduplication
description: Collapse duplicate requests with dedupeKey
---

# Deduplication

How to automatically collapse duplicate requests for the same logical resource.

## What is dedupeKey

`dedupeKey` identifies "which resource this request is for":

```ts
const saveAction = actionOptions({
  actionKey: 'save',
  request: (input: { id: string; data: string }) => api.save(input),
  dedupeKey: (input) => input.id, // same id = same resource
});
```

When a job with the same `actionKey` + `dedupeKey` already exists in the queue as `queued`, the new request **replaces** its `input` instead of creating a new job.

## Scenarios

### Offline — same resource saved multiple times

```
execute({ id: '1', data: 'v1' })  → queue: [v1]
execute({ id: '1', data: 'v2' })  → queue: [v2] (v1 replaced)
execute({ id: '1', data: 'v3' })  → queue: [v3] (v2 replaced)

Reconnect → server receives v3 only
```

Only 1 job is kept in the queue. `createdAt` and `attempt` are also reset.

### Online — rapid successive saves

```
execute({ id: '1', data: 'v1' })  → running
execute({ id: '1', data: 'v2' })  → queued (hasRunningDupe)
execute({ id: '1', data: 'v3' })  → v2 replaced by v3 in queue

v1 completes → v3 runs → server receives v1, v3 (v2 skipped)
```

### Different resources are independent

Different `dedupeKey` values are treated independently:

```
execute({ id: '1', data: 'a' })  → queue: [id:1=a]
execute({ id: '2', data: 'b' })  → queue: [id:1=a, id:2=b]
execute({ id: '1', data: 'c' })  → queue: [id:1=c, id:2=b]
```

### Without dedupeKey

Every request becomes an independent job:

```
execute({ msg: 'a' })  → queue: [a]
execute({ msg: 'b' })  → queue: [a, b]
execute({ msg: 'a' })  → queue: [a, b, a]
```

Good for logging, analytics, or any action where every call matters.

## Stale data prevention

When an online request fails with retry configured:

```
execute({ id: '1', data: 'v1' })  → running → fails → queued (retry pending)
execute({ id: '1', data: 'v2' })  → v1 is queued, so input replaced with v2

Retry timer → sends v2 (not stale v1)
```

If v1 is still running when v2 arrives:

```
execute({ id: '1', data: 'v1' })  → running
execute({ id: '1', data: 'v2' })  → new job (running dupe)
v1 fails → v2 exists in queue → v1 canceled (stale data prevention)
```

## Common Patterns

### Auto-save

```ts
const autoSaveAction = actionOptions({
  actionKey: 'autoSave',
  request: (input: { docId: string; content: string }) => api.save(input),
  dedupeKey: (input) => input.docId,
});

// Called on every keystroke — queue keeps only the latest
onChange((content) => {
  execute({ docId: currentDocId, content });
});
```

### Like toggle

```ts
// No dedupeKey — each click is an independent request
const likeAction = actionOptions({
  actionKey: 'like',
  request: (input: { itemId: string }) => api.toggleLike(input),
});
```

### Composite dedupeKey

```ts
const saveAction = actionOptions({
  actionKey: 'save',
  request: (input: { projectId: string; pageId: string; data: string }) => api.save(input),
  dedupeKey: (input) => `${input.projectId}:${input.pageId}`,
});
```

## Related

- [Offline Behavior](./offline-behavior.md) — execution flow, hasRunningDupe
- [Flush Control](../advanced/flush-control.md) — `dedupeOnFlush` strategy
- [useAction API](../api/react/use-action.md)

