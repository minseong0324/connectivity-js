# ConnectivityProvider

`ConnectivityClient`를 설정하고 React 트리에 default options를 제공하는 provider 컴포넌트입니다.

## 시그니처

```tsx
function ConnectivityProvider(props: ConnectivityProviderProps): ReactElement;
```

## Props

| Prop | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `children` | `ReactNode` | ✅ | — | React 트리 |
| `detectors` | `Detector[]` | ✅ | — | connectivity 감지 전략 |
| `gracePeriodMs` | `number` | | `0` | offline 전환 유예 기간 (ms) |
| `onJobError` | `(error, job) => void` | | — | job 최종 실패 시 호출 |
| `defaultOptions` | `ConnectivityProviderOptions` | | — | 전역 기본값 |

### defaultOptions

```ts
interface ConnectivityProviderOptions {
  actions?: Partial<ActionOptions>;
  connectivity?: {
    fallback?: ReactNode;
    delayMs?: number;
  };
};
```

## 동작

1. 최초 렌더 시 `getConnectivityClient(options)`로 singleton 초기화
2. `useEffect`에서 `client.start()` 호출
3. unmount 시 `client.destroy()` 호출
4. `defaultOptions`를 React Context로 하위 트리에 전달

## Example

```tsx
<ConnectivityProvider
  detectors={[browserOnlineDetector(), heartbeatDetector({ url: '/api/health' })]}
  gracePeriodMs={3_000}
  onJobError={(error, job) => Sentry.captureException(error, { extra: { jobId: job.id } })}
  defaultOptions={{
    actions: {
      whenOffline: 'queue',
      retry: { maxAttempts: 3, backoffMs: (n) => n * 1_000 },
    },
    connectivity: {
      fallback: <GlobalOffline />,
      delayMs: 2_000,
    },
  }}
>
  <App />
</ConnectivityProvider>
```

## Provider 없이 사용

모든 hook은 singleton을 직접 참조하므로 Provider 없이도 동작합니다. Provider가 없으면:
- `defaultOptions`가 적용되지 않음
- `start()`를 직접 호출해야 함

자세한 내용은 [React 없이 사용](../advanced/vanilla-js.md)을 참고하세요.

## 관련 문서

- [액션](../guide/actions.md)
- [전역 기본값](../advanced/default-options.md)
- [ConnectivityClient API](./connectivity-client.md)

