# Testing Guide

How to test code that uses Connectivity.

## Test isolation

`ConnectivityClient` is a singleton. Reset it after each test to prevent state leakage:

```ts
import { describe, test, afterEach, vi } from 'vitest';
import { ConnectivityClient } from '@connectivity/core';

afterEach(() => {
  ConnectivityClient.resetInstance();
  vi.restoreAllMocks();
});
```

## Mock Detector

Control network state programmatically in tests:

```ts
import type { Detector, DetectorEvent } from '@connectivity/core';

const createMockDetector = () => {
  let listener: ((event: DetectorEvent) => void) | null = null;

  const detector: Detector = {
    start: (cb) => {
      listener = cb;
      return () => { listener = null; };
    },
  };

  const emit = (event: DetectorEvent) => listener?.(event);
  const goOnline = () => emit({ status: 'online', reason: 'mock' });
  const goOffline = () => emit({ status: 'offline', reason: 'mock' });

  return { detector, emit, goOnline, goOffline };
};
```

## Basic test patterns

```ts
import { getConnectivityClient, ConnectivityClient } from '@connectivity/core';

describe('My feature', () => {
  afterEach(() => {
    ConnectivityClient.resetInstance();
  });

  test('saves immediately when online', async () => {
    const { detector, goOnline } = createMockDetector();
    const client = getConnectivityClient({
      detectors: [detector],
      initialStatus: 'online',
    });
    client.start();
    goOnline();

    const mockRequest = vi.fn().mockResolvedValue({ success: true });
    client.registerAction('save', {
      request: mockRequest,
      options: { whenOffline: 'queue' },
    });

    const result = await client.execute('save', { id: '1', data: 'hello' });

    expect(result.enqueued).toBe(false);
    expect(mockRequest).toHaveBeenCalledWith({ id: '1', data: 'hello' });
  });

  test('queues when offline', async () => {
    const { detector, goOffline } = createMockDetector();
    const client = getConnectivityClient({
      detectors: [detector],
      initialStatus: 'offline',
    });
    client.start();
    goOffline();

    client.registerAction('save', {
      request: vi.fn(),
      options: { whenOffline: 'queue' },
    });

    const result = await client.execute('save', { id: '1', data: 'hello' });

    expect(result.enqueued).toBe(true);
  });
});
```

## React hook testing

Use `@testing-library/react`'s `renderHook`:

```tsx
import { renderHook, act } from '@testing-library/react';
import { useConnectivity } from '@connectivity/react';
import { getConnectivityClient, ConnectivityClient } from '@connectivity/core';

describe('useConnectivity', () => {
  afterEach(() => {
    ConnectivityClient.resetInstance();
  });

  test('subscribes to state changes', () => {
    const { detector, goOnline, goOffline } = createMockDetector();
    getConnectivityClient({ detectors: [detector], initialStatus: 'unknown' });
    getConnectivityClient().start();

    const { result } = renderHook(() => useConnectivity());

    act(() => goOnline());
    expect(result.current.status).toBe('online');

    act(() => goOffline());
    expect(result.current.status).toBe('offline');
  });
});
```

## Timer testing

For retry, grace period, and other timer-based features, use `vi.useFakeTimers()`:

```ts
test('retry executes after backoff', async () => {
  vi.useFakeTimers();

  const { detector, goOnline } = createMockDetector();
  const client = getConnectivityClient({ detectors: [detector], initialStatus: 'online' });
  client.start();
  goOnline();

  const mockRequest = vi.fn()
    .mockRejectedValueOnce(new Error('fail'))
    .mockResolvedValueOnce({ ok: true });

  client.registerAction('save', {
    request: mockRequest,
    options: {
      retry: { maxAttempts: 2, backoffMs: () => 1_000 },
    },
  });

  const resultPromise = client.execute('save', { data: 'test' });
  await vi.advanceTimersByTimeAsync(1_000);

  const result = await resultPromise;
  expect(result.enqueued).toBe(true);

  vi.useRealTimers();
});
```

## actionKey conventions

`actionKey` is a unique string identifying an action. To prevent collisions:

```ts
// ✅ Good — domain:verb pattern
'document:save'
'document:export'
'user:updateProfile'
'analytics:trackEvent'

// ✅ Good — slash separator
'document/save'
'document/export'

// ❌ Bad — too generic
'save'
'update'
'fetch'
```

Recommended: centralize action keys:

```ts
// constants/action-keys.ts
export const ACTION_KEYS = {
  DOCUMENT_SAVE: 'document:save',
  DOCUMENT_EXPORT: 'document:export',
  USER_UPDATE_PROFILE: 'user:updateProfile',
} as const;
```

## Related

- [ConnectivityClient API](../api/core/connectivity-client.md)
- [useAction API](../api/react/use-action.md)

