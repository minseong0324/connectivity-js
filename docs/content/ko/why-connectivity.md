# 왜 Connectivity인가요?

## 문제

대부분의 웹 앱은 안정적인 네트워크를 전제합니다. 연결이 끊기면 조용히 실패합니다:

- API 호출이 복구 없이 실패
- 사용자가 저장하지 못한 작업을 잃음
- 재시도 로직이 모든 fetch 호출에 흩어져 있음
- "오프라인입니다"를 보여줄 통합된 방법이 없음

일반적인 접근 방식:

```tsx
function SaveButton({ data }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleSave = async () => {
    if (!isOnline) {
      alert("오프라인 상태입니다");
      return;
    }
    try {
      await api.save(data);
    } catch (err) {
      // 재시도? 몇 번? 백오프는?
      // 재시도 중 사용자가 또 클릭하면?
      // 중복 제거는?
    }
  };

  return <button onClick={handleSave}>저장</button>;
}
```

서버와 통신하는 모든 컴포넌트가 다음을 직접 해야 합니다:

1. 온라인/오프라인 상태를 수동으로 추적
2. 자체 에러 처리와 재시도 구현
3. 중복 제출 방지
4. 오프라인일 때 어떻게 할지 결정 (차단? 큐? 무시?)

결과는 **일관성 없는 동작**, **중복된 로직**, **깨지기 쉬운 코드**입니다.

## 해결

Connectivity는 이 모든 것을 하나의 레이어로 통합합니다:

```tsx
function SaveButton({ data }) {
  const { execute, pendingCount } = useAction(
    {
      actionKey: "save",
      request: (input: string) => api.save(input),
      dedupeKey: () => "save",
    },
    {
      onSuccess: () => toast.success("저장 완료"),
      onEnqueued: () => toast.info("큐에 저장됨 — 온라인 복구 시 전송됩니다"),
    }
  );

  return (
    <button onClick={() => execute(data)}>
      저장 {pendingCount > 0 && `(${pendingCount}개 대기)`}
    </button>
  );
}
```

수동 온라인/오프라인 추적 없음. 재시도 배관 없음. 중복 방지 가드 없음.

## 비교

| 관심사               | Connectivity 없이                | Connectivity 사용 시                      |
| -------------------- | -------------------------------- | ----------------------------------------- |
| 온라인/오프라인 감지 | 수동 `navigator.onLine` + 이벤트 | `useConnectivity()` 또는 `<Connectivity>` |
| 오프라인 동작        | 차단 또는 무시                   | 설정 가능: `queue`, `throw`, `skip`       |
| 큐잉                 | 직접 구현                        | 자동 FIFO 큐, 연결 복구 시 전송           |
| 중복 제거            | 수동 가드                        | 내장 `dedupeKey` — 최신 데이터만 전송     |
| 재시도               | 호출마다 try/catch 루프          | 선언적 재시도 정책 + 백오프               |
| Grace period         | 없음                             | 짧은 연결 끊김에 의한 깜빡임 방지         |
| 타입 안전성          | 모든 곳에서 수동 타입            | 액션 정의에서 완전 추론                   |
| 프레임워크 결합      | 강한 결합                        | 코어는 프레임워크 비의존                  |

## 설계 원칙

### 선언적 > 명령적

_어떻게_ 연결하는지가 아니라 *무엇*이 일어나야 하는지를 기술합니다 (오프라인이면 큐, ID로 중복 제거, 3번 재시도).

### 관례 + 탈출구

합리적인 기본값이 바로 동작합니다. 모든 동작은 액션별 또는 `defaultOptions`를 통해 전역으로 오버라이드할 수 있습니다.

### 예측 가능한 상태 전환

연결 상태 머신은 명확한 전환(`online → offline → online`)을 가지며, grace period로 빠른 깜빡임을 방지합니다.

## 다음 단계

- [설치하기](./installation.md) — 프로젝트에 Connectivity 추가
- [시작하기](./guide/getting-started.md) — 첫 번째 액션 만들기
