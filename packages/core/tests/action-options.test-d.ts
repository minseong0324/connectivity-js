import { describe, expectTypeOf, it } from 'vitest';
import { actionOptions } from '../src/action-options';
import type { ActionOptionsConfig } from '../src/action-options';

describe('actionOptions', () => {
  describe('TInput inference', () => {
    const saveAction = actionOptions({
      actionKey: 'save',
      request: async (_input: { designId: string }) => ({ saved: true }),
    });

    // request parameter type inferred as TInput({ designId: string })
    expectTypeOf(saveAction.request)
      .parameter(0)
      .toExtend<{ designId: string }>();

    it('infers dedupeKey parameter as the same type as TInput', () => {
      const action = actionOptions({
        actionKey: 'save',
        request: async (_input: { designId: string }) => ({ saved: true }),
        dedupeKey: (input) => {
          // input should be inferred as { designId: string }
          expectTypeOf(input).toExtend<{ designId: string }>();
          return input.designId;
        },
      });

      expectTypeOf(action).toExtend<
        ActionOptionsConfig<{ designId: string }, { saved: boolean }>
      >();
    });

    it('type error when dedupeKey parameter type differs from TInput', () => {
      actionOptions({
        actionKey: 'save',
        request: async (_input: { designId: string }) => ({ saved: true }),
        // @ts-expect-error — dedupeKey parameter must be TInput({ designId: string })
        dedupeKey: (input: number) => String(input),
      });
    });
  });

  describe('TResult inference', () => {
    const saveAction = actionOptions({
      actionKey: 'save',
      request: async (_input: { designId: string }) => ({ saved: true }),
    });

    // request return type inferred as Promise<TResult>
    expectTypeOf(saveAction.request).returns.toExtend<
      Promise<{ saved: boolean }>
    >();

    it('type error when request returns value inconsistent with declared return type', () => {
      actionOptions<{ id: string }, number>({
        actionKey: 'save',
        // @ts-expect-error — must return Promise<number> but returns string
        request: async (_input: { id: string }) => 'not-a-number',
      });
    });
  });

  describe('full config type preservation', () => {
    it('all option fields are compatible with ActionOptionsConfig<TInput, TResult>', () => {
      const action = actionOptions({
        actionKey: 'upload',
        request: async (_input: { file: string }) => ({ url: 'https://...' }),
        whenOffline: 'queue',
        retry: { maxAttempts: 3, backoffMs: (n) => n * 1_000 },
        flushOption: { concurrency: 2, intervalMs: 500 },
        dedupeKey: (input) => input.file,
        dedupeOnFlush: 'keep-last',
      });

      expectTypeOf(action).toExtend<
        ActionOptionsConfig<{ file: string }, { url: string }>
      >();
    });
  });
});
