# 설치하기

## 패키지

Connectivity는 두 개의 패키지로 구성됩니다:

| 패키지                | 설명                                                     |
| --------------------- | -------------------------------------------------------- |
| `@connectivity-js/core`  | 프레임워크 비의존 코어: 상태 머신, 큐, 중복 제거, 재시도 |
| `@connectivity-js/react` | React 훅과 컴포넌트 (`@connectivity-js/core`에 의존)        |

React 프로젝트에서는 `@connectivity-js/react`를 설치합니다.

```bash tab="pnpm"
pnpm add @connectivity-js/react
```

```bash tab="npm"
npm install @connectivity-js/react
```

```bash tab="yarn"
yarn add @connectivity-js/react
```

### Peer Dependencies

`@connectivity-js/react`는 다음이 필요합니다:

- `react` ^18 || ^19

## Provider 설정

애플리케이션 최상위를 `ConnectivityProvider`로 감쌉니다:

```tsx
import {
  ConnectivityProvider,
  browserOnlineDetector,
  heartbeatDetector,
} from "@connectivity-js/react";

function App() {
  return (
    <ConnectivityProvider
      detectors={[
        browserOnlineDetector(),
        heartbeatDetector({ url: "/api/health" }),
      ]}
      gracePeriodMs={3_000}
      defaultOptions={{
        actions: { whenOffline: "queue" },
      }}
    >
      <YourApp />
    </ConnectivityProvider>
  );
}
```

### `detectors`

네트워크 상태를 감지하는 전략입니다. 여러 개를 조합하여 신뢰성을 높일 수 있습니다:

- **`browserOnlineDetector()`** — `navigator.onLine` + 브라우저 이벤트를 사용합니다. 빠르지만 "LAN은 연결, 인터넷은 불가" 상태를 감지하지 못합니다.
- **`heartbeatDetector({ url })`** — 주기적으로 HEAD 요청을 보내 실제 연결을 확인합니다. RTT도 측정합니다.

둘을 함께 사용하면: `browserOnlineDetector`가 즉시 반응하고, `heartbeatDetector`가 실제 연결을 검증합니다.

### `gracePeriodMs`

일시적 연결 끊김에 의한 상태 전환을 억제합니다. 이 시간 내에 복구되면 오프라인 전환이 무시됩니다. 자세한 내용은 [Grace Period](./advanced/grace-period.md)를 참고하세요.

### `defaultOptions`

모든 `useAction`과 `<Connectivity>`에 적용되는 전역 기본값입니다. 자세한 내용은 [전역 기본값](./advanced/default-options.md)을 참고하세요.

## DevTools (선택)

디버깅용 DevTools 패널을 사용하려면:

- **React**: `@connectivity-js/react-devtools`
- **Vanilla JS**: `@connectivity-js/devtools`

자세한 내용은 [DevTools](./advanced/devtools.md)를 참고하세요.

## React 없이 사용하기

React를 사용하지 않는 경우 `@connectivity-js/core`만 단독으로 사용할 수 있습니다:

```bash tab="pnpm"
pnpm add @connectivity-js/core
```

```bash tab="npm"
npm install @connectivity-js/core
```

```bash tab="yarn"
yarn add @connectivity-js/core
```

자세한 내용은 [Vanilla JS](./advanced/vanilla-js.md)를 참고하세요.

## 다음 단계

- [연결 상태 UI](./guide/connectivity-ui.md) — `<Connectivity>`, `useConnectivity`로 온라인/오프라인 UI 전환
- [액션](./guide/actions.md) — 첫 번째 액션 정의하고 실행하기
