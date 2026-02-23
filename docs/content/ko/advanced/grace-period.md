# Grace Period

일시적 연결 끊김에 의한 offline 전환을 억제하는 방법을 설명합니다.

## 왜 필요한가

Wi-Fi 전환, 터널 통과, 모바일 네트워크 핸드오프 등으로 연결이 1~2초간 끊겼다가 바로 복구되는 경우가 흔합니다. 이때마다 offline UI를 표시하면 사용자 경험이 나빠집니다.

## 설정

```tsx
<ConnectivityProvider
  detectors={[browserOnlineDetector()]}
  gracePeriodMs={3_000} // 3초 유예
>
  <App />
</ConnectivityProvider>
```

## 동작

```
detector: offline 이벤트
  │
  ├─ gracePeriodMs 타이머 시작 (3초)
  │
  ├─ 3초 내 online 이벤트 도착
  │   → 타이머 취소. 상태 변경 없음. UI 변화 없음.
  │
  └─ 3초 초과
      → offline으로 상태 변경. listener에 transition 전달.
```

### 주의사항

- `gracePeriodMs`는 offline → online이 아닌 **offline 전환**에만 적용됩니다
- online → offline → (grace period) → online: 상태가 한 번도 offline으로 바뀌지 않습니다
- `gracePeriodMs: 0`이면 grace period가 비활성화됩니다 (기본값)

### Connectivity 컴포넌트의 delayMs와 차이

| | `gracePeriodMs` | `delayMs` |
|---|---|---|
| 적용 대상 | `ConnectivityClient` (전역) | `<Connectivity>` (컴포넌트별) |
| 영향 | 모든 subscriber, hook, queue flush | 해당 컴포넌트의 children/fallback 전환만 |
| 중복 사용 | 가능 — 서로 독립적으로 동작 |

```
gracePeriodMs=3s, delayMs=2s인 경우:

t=0s  detector: offline
t=3s  grace period 만료 → 상태: offline
t=5s  delayMs 만료 → UI: fallback 표시
```

## 관련 문서

- [연결 상태 UI](../guide/connectivity-ui.md)
- [ConnectivityProvider API](../api/react/connectivity-provider.md)

