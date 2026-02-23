# 소개

**Connectivity**는 선언적이고, 타입 안전하며, 오프라인 우선인 연결 관리 라이브러리입니다.

## 핵심 철학

현대 웹 애플리케이션은 네트워크 상태와 관계없이 안정적으로 동작해야 합니다. Connectivity는 온라인/오프라인 상태 관리, 액션 큐잉, 중복 제거, 재시도를 하나의 레이어로 통합하여, 인프라 코드 대신 제품 로직에 집중할 수 있게 합니다.

## 주요 기능

- **선언적** — `<Connectivity fallback={...}>` 한 줄로 온라인/오프라인 UI를 전환합니다.
- **타입 안전** — 액션 정의에서 `TInput`과 `TResult`가 완전히 추론됩니다. 수동 타입 지정이 필요 없습니다.
- **프레임워크 비의존** — 코어(`@connectivity-js/core`)는 프레임워크 의존성이 없습니다. React 어댑터(`@connectivity-js/react`)를 기본 제공하며, 다른 프레임워크 어댑터도 계획 중입니다.
- **자동 큐잉** — 오프라인 중 실행된 액션은 자동으로 큐에 저장되고, 연결 복구 시 FIFO 순서로 전송됩니다.
- **중복 제거** — 빠른 연속 호출(예: 저장 버튼 더블클릭)을 합쳐서 최신 데이터만 서버에 전송합니다.
- **재시도** — 실패한 요청을 설정 가능한 백오프 전략으로 자동 재시도합니다.

## 아키텍처

```
ConnectivityProvider
  └─ ConnectivityClient (싱글턴)
       ├─ Detectors (browserOnline, heartbeat, 커스텀)
       ├─ ActionObserver (useAction 훅당 1개)
       │    ├─ execute / queue / dedup / retry
       │    └─ 콜백 (onSuccess, onEnqueued, onError)
       ├─ useConnectivity (반응형 상태)
       ├─ useQueue (대기 중인 작업)
       └─ useOnConnectivityChange (전환 이벤트)
```

| 레이어 | 패키지                | 설명                                                    |
| ------ | --------------------- | ------------------------------------------------------- |
| Core   | `@connectivity-js/core`  | 상태 머신, 큐, 중복 제거, 재시도. React 의존성 없음.    |
| React  | `@connectivity-js/react` | 훅과 컴포넌트: Provider, useAction, useConnectivity 등. |

## 간단한 예제

```tsx
import {
  ConnectivityProvider,
  browserOnlineDetector,
  useAction,
} from "@connectivity-js/react";

function App() {
  return (
    <ConnectivityProvider detectors={[browserOnlineDetector()]}>
      <SaveButton />
    </ConnectivityProvider>
  );
}

function SaveButton() {
  const { execute, pendingCount } = useAction({
    actionKey: "save",
    request: (data: string) => api.save(data),
  });

  return (
    <button onClick={() => execute("hello")}>
      저장 {pendingCount > 0 && `(${pendingCount}개 대기)`}
    </button>
  );
}
```

## 다음 단계

- [왜 Connectivity인가요?](./why-connectivity.md) — 이 라이브러리가 해결하는 문제
- [설치하기](./installation.md) — 프로젝트에 추가하기
- [연결 상태 UI](./guide/connectivity-ui.md) — `<Connectivity>`, `useConnectivity`로 온라인/오프라인 UI 전환
- [액션](./guide/actions.md) — 첫 번째 액션 정의하고 실행하기
