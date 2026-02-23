# 전역 기본값

`ConnectivityProvider`에서 모든 hook과 컴포넌트에 적용되는 기본값을 설정하는 방법을 설명합니다.

## 설정

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

모든 `useAction`에 적용되는 기본 action 옵션입니다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `whenOffline` | `'queue' \| 'fail'` | offline 시 기본 동작 |
| `retry` | `RetryPolicy` | 기본 재시도 정책 |
| `flushOption` | `FlushOption` | 기본 flush 제어 |
| `dedupeOnFlush` | `'keep-first' \| 'keep-last'` | 기본 flush 시 dedupe 전략 |

### 병합 규칙

per-action에서 설정한 값이 전역 기본값을 **override**합니다:

```ts
// 전역: retry maxAttempts=3
// per-action: retry maxAttempts=5
// → 결과: maxAttempts=5 (per-action 우선)

// 전역: whenOffline='queue'
// per-action: 미설정
// → 결과: whenOffline='queue' (전역 기본값 적용)
```

`flushOption`도 동일한 규칙을 따릅니다. `concurrency`와 `intervalMs` 모두 per-action 값이 우선하고, 미설정 시 전역 기본값이 적용됩니다.

### 예시: 모든 action에 retry 적용

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

// 개별 action에서 retry를 설정하지 않아도 자동 적용됨
const { execute } = useAction({
  actionKey: 'save',
  request: (input) => api.save(input),
  // retry: 전역 기본값 { maxAttempts: 3, backoffMs: ... } 적용됨
});
```

## defaultOptions.connectivity

`<Connectivity>` 컴포넌트의 기본 `fallback`과 `delayMs`를 설정합니다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `fallback` | `ReactNode` | 기본 offline fallback UI |
| `delayMs` | `number` | 기본 offline 전환 지연 시간 |

### 예시

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
  {/* fallback, delayMs를 지정하지 않으면 전역 기본값 사용 */}
  <Connectivity>
    <App />
  </Connectivity>

  {/* 개별 override */}
  <Connectivity fallback={<CustomFallback />} delayMs={0}>
    <CriticalSection />
  </Connectivity>
</ConnectivityProvider>
```

## 관련 문서

- [ConnectivityProvider API](../api/react/connectivity-provider.md)
- [Flush 제어](./flush-control.md)
- [Retry](./retry.md)

