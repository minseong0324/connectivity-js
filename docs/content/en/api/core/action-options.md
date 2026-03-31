# actionOptions

Type-safe identity function for defining action configuration.

## Signature

```ts
function actionOptions<TInput, TResult>(
  config: ActionOptionsConfig<TInput, TResult>
): ActionOptionsConfig<TInput, TResult>;
```

Returns the input `config` as-is. Exists purely for TypeScript inference.

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

`TInput` and `TResult` are inferred from `request`.

## Example

```ts
export const saveAction = actionOptions({
  actionKey: 'save',
  request: (input: { id: string; data: string }) => api.save(input),
  dedupeKey: (input) => input.id, // input type inferred
  whenOffline: 'queue',
  retry: { maxAttempts: 3, backoffMs: (n) => n * 1_000 },
});

const { execute } = useAction(saveAction);
execute({ id: '1', data: 'hello' }); // ✅ type checked
execute({ wrong: true });             // ❌ compile error
```

## When to use

- Same action used across multiple components
- Action config in a separate file

For single-component usage, pass config inline to `useAction()`.

## Related

- [useAction API](../react/use-action)
- [Actions](../guide/actions.md)

