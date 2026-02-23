import { describe, expectTypeOf, it } from 'vitest';
import { actionOptions } from '@connectivity/core';
import { useAction } from '../src/use-action';

describe('useAction', () => {
  describe('TInput propagation — execute parameter type', () => {
    const saveAction = actionOptions({
      actionKey: 'save',
      request: async (_input: { designId: string }) => ({ saved: true }),
    });

    const { execute } = useAction(saveAction);

    // execute parameter type narrowed to TInput({ designId: string })
    expectTypeOf(execute).parameter(0).toExtend<{ designId: string }>();

    it('no type error when passing correctly typed input', () => {
      execute({ designId: 'abc-123' });
    });

    it('type error when passing type other than TInput to execute', () => {
      // @ts-expect-error — must pass { designId: string } but passing string
      execute('wrong');
    });

    it('type error when passing object missing required fields to execute', () => {
      // @ts-expect-error — object missing designId field
      execute({});
    });
  });

  describe('TResult propagation — onSuccess callback parameter type', () => {
    const saveAction = actionOptions({
      actionKey: 'save',
      request: async (_input: { designId: string }) => ({ saved: true }),
    });

    it('onSuccess parameter is narrowed to TResult({ saved: boolean })', () => {
      useAction(saveAction, {
        onSuccess: (result) => {
          // result should be inferred as { saved: boolean }
          expectTypeOf(result).toExtend<{ saved: boolean }>();
        },
      });
    });
  });

  describe('return value types', () => {
    const saveAction = actionOptions({
      actionKey: 'save',
      request: async (_input: { designId: string }) => ({ saved: true }),
    });

    const { pendingCount, lastError } = useAction(saveAction);

    // pendingCount is number of pending jobs, always number
    expectTypeOf(pendingCount).toBeNumber();

    // lastError is last failure error, unknown type
    expectTypeOf(lastError).toBeUnknown();
  });

  describe('all callbacks are optional', () => {
    const saveAction = actionOptions({
      actionKey: 'save',
      request: async (_input: { designId: string }) => ({ saved: true }),
    });

    it('can be called without second argument (callbacks)', () => {
      useAction(saveAction);
    });

    it('no error when passing only some callbacks', () => {
      useAction(saveAction, { onSuccess: () => {} });
      useAction(saveAction, { onError: () => {} });
      useAction(saveAction, { onEnqueued: (_jobId) => {} });
      useAction(saveAction, { onSettled: () => {} });
    });
  });
});
