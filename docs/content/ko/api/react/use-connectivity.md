# useConnectivity

현재 연결 상태를 구독하는 hook입니다.

## 시그니처

```ts
function useConnectivity(): ConnectivityState;
```

파라미터 없음. `ConnectivityProvider` 없이도 동작합니다.

## Returns

```ts
interface ConnectivityState {
  status: 'online' | 'offline' | 'unknown';
  since: number;      // 현재 상태가 시작된 Date.now() 값
  reason?: string;    // 상태 변경 원인 (e.g. 'navigator', 'heartbeat')
  quality: {
    rttMs?: number;          // heartbeat RTT (ms)
    effectiveType?: string;  // '4g', '3g', '2g'
    downlink?: number;       // 예상 속도 (Mbps)
  };
};
```

상태가 변경될 때만 새 참조를 반환합니다. `quality`만 변경되어도 새 참조가 생성됩니다.

## Example

```tsx
function StatusBadge() {
  const { status, quality } = useConnectivity();

  if (status === 'offline') return <Badge color="red">오프라인</Badge>;
  if (quality.rttMs !== undefined && quality.rttMs > 500) {
    return <Badge color="yellow">느린 연결</Badge>;
  }
  return <Badge color="green">온라인</Badge>;
}
```

## SSR

서버 렌더링 시 `{ status: 'unknown', since: 0, quality: {} }`를 반환합니다.

## 관련 문서

- [연결 상태 UI 가이드](../guide/connectivity-ui.md)
- [Connectivity API](./connectivity.md)

