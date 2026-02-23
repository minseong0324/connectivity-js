# Connectivity

연결 상태에 따라 children/fallback을 전환하는 컴포넌트입니다.

## 시그니처

```tsx
function Connectivity(props: ConnectivityProps): ReactElement;
```

## Props

| Prop | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `children` | `ReactNode` | (필수) | online 시 표시할 UI |
| `fallback` | `ReactNode` | `null` | offline 시 표시할 대체 UI |
| `delayMs` | `number` | `0` | offline 전환 시 UI 변경 지연 시간 (ms) |

`fallback`과 `delayMs`의 기본값은 `ConnectivityProvider`의 `defaultOptions.connectivity`에서 가져옵니다.

## Example

```tsx
<Connectivity fallback={<OfflineBanner />} delayMs={2_000}>
  <App />
</Connectivity>
```

## 동작

- `unknown` 상태는 online으로 취급 (SSR 호환)
- `delayMs > 0`이면 offline 전환 후 지정 시간 동안 children 유지
- 지연 시간 내 online 복귀 시 fallback이 표시되지 않음

## 관련 문서

- [연결 상태 UI 가이드](../guide/connectivity-ui.md)
- [전역 기본값](../advanced/default-options.md)

