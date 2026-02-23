# useOnConnectivityChange

연결 상태 전환 시 콜백을 실행하는 hook입니다.

## 시그니처

```ts
function useOnConnectivityChange(handlers: ConnectivityChangeHandlers): void;

type ConnectivityChangeHandlers = Partial<
  Record<'online' | 'offline' | 'unknown', (transition: ConnectivityTransition) => void>
>;

interface ConnectivityTransition {
  from: ConnectivityStatus;
  to: ConnectivityStatus;
  duration: number; // 이전 상태 유지 시간 (ms)
};
```

## Parameters

| 필드 | 타입 | 설명 |
|---|---|---|
| `online` | `(transition) => void` | online으로 전환될 때 호출 |
| `offline` | `(transition) => void` | offline으로 전환될 때 호출 |
| `unknown` | `(transition) => void` | unknown으로 전환될 때 호출 |

모든 handler는 선택적입니다. inline 함수를 넘겨도 매 렌더마다 재구독하지 않습니다 (ref 패턴).

## Example

```tsx
useOnConnectivityChange({
  offline: () => toast.warning('연결이 끊겼습니다'),
  online: (transition) => {
    if (transition.duration > 60_000) {
      dialog.open(ReconnectedNotice);
      return;
    }
    toast.success('연결이 복구되었습니다');
  },
});
```

최초 마운트 시에는 호출되지 않습니다. 상태가 **전환**될 때만 호출됩니다.

## 관련 문서

- [연결 상태 UI 가이드](../guide/connectivity-ui.md)

