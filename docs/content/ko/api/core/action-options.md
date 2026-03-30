# actionOptions

action 설정을 type-safe하게 정의하는 identity 함수입니다.

## 시그니처

```ts
function actionOptions<TInput, TResult>(
  config: ActionOptionsConfig<TInput, TResult>
): ActionOptionsConfig<TInput, TResult>;
```

입력받은 `config`를 그대로 반환합니다. TypeScript에게 타입을 추론하게 하기 위한 용도입니다.

## ActionOptionsConfig

```ts
interface ActionOptionsConfig<TInput, TResult> {
  actionKey: string;
  request: (input: TInput) => Promise<TResult>;
  whenOffline?: 'queue' | 'fail';
  retry?: RetryPolicy;
  flushOption?: FlushOption;
  dedupeKey?: (input: TInput) => string;
  dedupeOnFlush?: 'keep-first' | 'keep-last';
};
```

`TInput`과 `TResult`는 `request` 함수에서 자동 추론됩니다.

## Example

```ts
// 변수로 추출 — 여러 컴포넌트에서 재사용
export const saveAction = actionOptions({
  actionKey: 'save',
  request: (input: { id: string; data: string }) => api.save(input),
  dedupeKey: (input) => input.id, // input 타입 추론됨
  whenOffline: 'queue',
  retry: { maxAttempts: 3, backoffMs: (n) => n * 1_000 },
});

// hook에서 사용
const { execute } = useAction(saveAction);
execute({ id: '1', data: 'hello' }); // ✅ 타입 체크됨
execute({ wrong: true });             // ❌ 컴파일 에러
```

## 언제 사용하나요?

- 같은 action을 여러 컴포넌트에서 사용할 때
- action 설정을 별도 파일로 분리할 때

하나의 컴포넌트에서만 사용한다면 `useAction()`에 inline으로 전달해도 됩니다.

## 관련 문서

- [useAction API](../react/use-action)
- [액션](../guide/actions.md)

