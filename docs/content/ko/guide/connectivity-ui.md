# 연결 상태 UI

유저에게 현재 네트워크 상태를 보여주는 방법을 설명합니다.

## useConnectivity

현재 연결 상태를 구독합니다. 상태가 변경될 때만 re-render됩니다.

```tsx
import { useConnectivity } from '@connectivity-js/react';

function StatusBadge() {
  const { status, quality } = useConnectivity();

  if (status === 'offline') return <Badge color="red">오프라인</Badge>;
  if (quality.rttMs !== undefined && quality.rttMs > 500) {
    return <Badge color="yellow">느린 연결</Badge>;
  }
  return <Badge color="green">온라인</Badge>;
}
```

반환값:

| 필드 | 타입 | 설명 |
|---|---|---|
| `status` | `'online' \| 'offline' \| 'unknown'` | 현재 상태. 조건 분기 시 타입 자동 좁힘 |
| `since` | `number` | 현재 상태가 시작된 `Date.now()` 값 |
| `reason` | `string?` | 상태 변경 원인 (예: `'navigator'`, `'heartbeat'`) |
| `quality` | `ConnectionQuality` | RTT, effectiveType, downlink |

### Common Patterns

**상태바에 실시간 표시:**

```tsx
function ConnectionIndicator() {
  const { status } = useConnectivity();

  return (
    <div className="status-bar">
      <span className={`dot dot--${status}`} />
      {status === 'offline' && '오프라인'}
      {status === 'online' && '온라인'}
      {status === 'unknown' && '확인 중...'}
    </div>
  );
}
```

**느린 연결 감지:**

```tsx
function SlowConnectionWarning() {
  const { status, quality } = useConnectivity();

  if (status !== 'online') return null;
  if (quality.rttMs === undefined || quality.rttMs <= 1_000) return null;

  return <Banner>연결이 느립니다. 저장에 시간이 걸릴 수 있습니다.</Banner>;
}
```

**offline 지속 시간 표시:**

```tsx
function OfflineDuration() {
  const { status, since } = useConnectivity();

  if (status !== 'offline') return null;

  const elapsed = Math.round((Date.now() - since) / 1_000);
  return <span>오프라인 {elapsed}초 경과</span>;
}
```

## Connectivity

연결 상태에 따라 선언적으로 children/fallback을 전환합니다.

```tsx
import { Connectivity } from '@connectivity-js/react';

<Connectivity fallback={<OfflineScreen />}>
  <App />
</Connectivity>
```

online이면 `children`, offline이면 `fallback`을 렌더링합니다. `unknown` 상태는 online으로 취급합니다 (SSR 호환).

### `delayMs`

offline 전환 시 UI 변경을 지연합니다. 일시적 끊김에 의한 깜빡임을 방지합니다:

```tsx
<Connectivity fallback={<OfflineScreen />} delayMs={2_000}>
  <App />
</Connectivity>
```

- offline 이벤트 → 2초 동안 children 유지
- 2초 내 복구 → fallback이 전혀 표시되지 않음
- 2초 초과 → fallback으로 전환

### 기본값 설정

`ConnectivityProvider`에서 전체 앱의 기본 `fallback`과 `delayMs`를 설정할 수 있습니다:

```tsx
<ConnectivityProvider
  detectors={[...]}
  defaultOptions={{
    connectivity: {
      fallback: <GlobalOfflineScreen />,
      delayMs: 2_000,
    },
  }}
>
  {/* 이 안의 모든 <Connectivity>에 기본값 적용 */}
  <Connectivity>
    <App />
  </Connectivity>

  {/* 개별 override도 가능 */}
  <Connectivity fallback={<CustomFallback />} delayMs={0}>
    <CriticalSection />
  </Connectivity>
</ConnectivityProvider>
```

### Common Patterns

**페이지 전체 offline 스크린:**

```tsx
function RootLayout({ children }) {
  return (
    <Connectivity fallback={<FullScreenOffline />} delayMs={3_000}>
      <Header />
      <Main>{children}</Main>
      <Footer />
    </Connectivity>
  );
}
```

**특정 섹션만 offline 처리:**

```tsx
function Dashboard() {
  return (
    <div>
      <StaticContent /> {/* 항상 표시 */}
      <Connectivity fallback={<p>이 섹션은 온라인에서만 사용할 수 있습니다.</p>}>
        <LiveData />
      </Connectivity>
    </div>
  );
}
```

## useOnConnectivityChange

상태가 **전환**될 때 콜백을 실행합니다. 최초 마운트 시에는 호출되지 않습니다.

```tsx
import { useOnConnectivityChange } from '@connectivity-js/react';

useOnConnectivityChange({
  offline: () => toast.warning('인터넷 연결이 끊겼습니다'),
  online: (transition) => {
    toast.success('인터넷 연결이 복구되었습니다');
  },
});
```

`transition` 객체:

| 필드 | 타입 | 설명 |
|---|---|---|
| `from` | `ConnectivityStatus` | 이전 상태 |
| `to` | `ConnectivityStatus` | 현재 상태 |
| `duration` | `number` | 이전 상태가 유지된 시간 (ms) |

### inline 함수 안전

이 hook은 callback을 ref로 저장하므로, inline 함수를 넘겨도 매 렌더마다 재구독하지 않습니다:

```tsx
// 안전 — 매 렌더 새 함수지만 재구독 없음
useOnConnectivityChange({
  offline: () => toast.warning('끊김'),
  online: () => toast.success('복구'),
});
```

### Common Patterns

**오래 끊겼을 때 다이얼로그 표시:**

```tsx
useOnConnectivityChange({
  online: (transition) => {
    if (transition.duration > 60_000) {
      overlay.open(({ close }) => (
        <ReconnectedDialog
          offlineDuration={transition.duration}
          onClose={close}
        />
      ));
      return;
    }
    toast.success('연결 복구');
  },
});
```

**offline 진입 시 자동저장:**

```tsx
useOnConnectivityChange({
  offline: () => {
    // offline 진입 시 현재 작업을 로컬에 저장
    saveToLocalStorage(getCurrentState());
  },
});
```

**상태 전환 로깅:**

```tsx
useOnConnectivityChange({
  online: (t) => analytics.track('connectivity_restored', { duration: t.duration }),
  offline: (t) => analytics.track('connectivity_lost', { from: t.from }),
});
```

## 알아두면 좋은 것

### Provider 없이도 동작

모든 hook은 `ConnectivityProvider` 없이도 singleton을 직접 참조하여 동작합니다. Provider가 없으면 `defaultOptions`가 적용되지 않을 뿐입니다.

### SSR 안전

서버 렌더링 시 모든 hook은 `'unknown'` 상태를 반환합니다. `<Connectivity>`는 `unknown`을 online으로 취급하므로 hydration mismatch가 발생하지 않습니다.

### 참조 안정성

`useConnectivity()`가 반환하는 `ConnectivityState` 객체는 상태가 변경될 때만 새 참조를 반환합니다. `quality`만 변경되어도 새 참조가 생성됩니다.

## 관련 문서

- [useConnectivity API](../api/react/use-connectivity.md)
- [Connectivity API](../api/react/connectivity.md)
- [useOnConnectivityChange API](../api/react/use-on-connectivity-change.md)
- [Grace Period](../advanced/grace-period.md) — 일시적 끊김 억제

