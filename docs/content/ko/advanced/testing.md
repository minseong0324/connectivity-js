# 테스트 가이드

Connectivity를 사용하는 코드를 테스트하는 방법을 설명합니다.

## 테스트 격리

`ConnectivityClient`는 singleton입니다. 테스트 간 상태가 누출되지 않도록 매 테스트 후 인스턴스를 초기화합니다:

```ts
import { describe, test, afterEach, vi } from 'vitest';
import { ConnectivityClient } from '@connectivity-js/core';

afterEach(() => {
  ConnectivityClient.resetInstance();
  vi.restoreAllMocks();
});
```

## Mock Detector

테스트에서 네트워크 상태를 프로그래밍 방식으로 제어하려면 mock detector를 사용합니다:

```ts
import type { Detector, DetectorEvent } from '@connectivity-js/core';

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

## 기본 테스트 패턴

```ts
import { getConnectivityClient, ConnectivityClient } from '@connectivity-js/core';

describe('내 컴포넌트', () => {
  afterEach(() => {
    ConnectivityClient.resetInstance();
  });

  test('online에서 즉시 저장한다', async () => {
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

  test('offline에서 큐에 저장한다', async () => {
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

## React hook 테스트

React hook은 `@testing-library/react`의 `renderHook`으로 테스트합니다:

```tsx
import { renderHook, act } from '@testing-library/react';
import { useConnectivity } from '@connectivity-js/react';
import { getConnectivityClient, ConnectivityClient } from '@connectivity-js/core';

describe('useConnectivity', () => {
  afterEach(() => {
    ConnectivityClient.resetInstance();
  });

  test('상태 변경을 구독한다', () => {
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

## 타이머 테스트

retry, grace period 등 타이머 관련 테스트는 `vi.useFakeTimers()`를 사용합니다:

```ts
test('retry가 backoff 후 실행된다', async () => {
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

  // 첫 실행 실패, retry 스케줄됨
  await vi.advanceTimersByTimeAsync(1_000);
  // retry 실행

  const result = await resultPromise;
  expect(result.enqueued).toBe(true); // retry로 enqueued 반환

  vi.useRealTimers();
});
```

## actionKey 컨벤션

`actionKey`는 action을 식별하는 고유 문자열입니다. 충돌을 방지하려면:

```ts
// ✅ 좋은 예 — 도메인:동사 형태
'document:save'
'document:export'
'user:updateProfile'
'analytics:trackEvent'

// ✅ 좋은 예 — 슬래시 구분
'document/save'
'document/export'

// ❌ 나쁜 예 — 너무 일반적
'save'
'update'
'fetch'
```

팀 내에서 일관된 규칙을 정하는 것이 중요합니다. 권장 패턴:

```ts
// constants/action-keys.ts
export const ACTION_KEYS = {
  DOCUMENT_SAVE: 'document:save',
  DOCUMENT_EXPORT: 'document:export',
  USER_UPDATE_PROFILE: 'user:updateProfile',
} as const;
```

## 관련 문서

- [ConnectivityClient API](../api/core/connectivity-client.md)
- [useAction API](../api/react/use-action.md)

