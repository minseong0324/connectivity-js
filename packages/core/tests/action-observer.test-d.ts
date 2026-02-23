import { describe, expectTypeOf, it } from 'vitest';
import { ActionObserver, actionOptions } from '../src/index';
import type { UseActionCallbacks, ConnectivityClient } from '../src/index';

describe('UseActionCallbacks', () => {
  describe('TResult propagation — callback parameter types', () => {
    it('onSuccess parameter is narrowed to TResult({ saved: boolean })', () => {
      const callbacks: UseActionCallbacks<{ saved: boolean }> = {
        onSuccess: (result) => {
          // result should be inferred as { saved: boolean } without explicit type
          expectTypeOf(result).toExtend<{ saved: boolean }>();
        },
      };

      void callbacks;
    });

    it('onEnqueued parameter is string (jobId)', () => {
      const callbacks: UseActionCallbacks<unknown> = {
        onEnqueued: (jobId) => {
          expectTypeOf(jobId).toBeString();
        },
      };

      void callbacks;
    });

    it('onError parameter is unknown', () => {
      const callbacks: UseActionCallbacks<unknown> = {
        onError: (error) => {
          expectTypeOf(error).toBeUnknown();
        },
      };

      void callbacks;
    });

    it('all callbacks are optional — no error when passing empty object', () => {
      const callbacks: UseActionCallbacks<{ saved: boolean }> = {};
      void callbacks;
    });
  });
});

describe('ActionObserver', () => {
  const client = {} as ConnectivityClient;

  const saveOptions = actionOptions({
    actionKey: 'save',
    request: async (_input: { designId: string }) => ({ saved: true }),
  });

  const observer = new ActionObserver(client, saveOptions);

  describe('execute — TInput propagation', () => {
    it('execute first parameter is narrowed to TInput({ designId: string })', () => {
      expectTypeOf(observer.execute)
        .parameter(0)
        .toExtend<{ designId: string }>();
    });

    it('type error when passing type other than TInput to execute', () => {
      // @ts-expect-error — must pass { designId: string } but passing string
      observer.execute('wrong');
    });
  });

  describe('getCurrentResult — return value types', () => {
    const result = observer.getCurrentResult();

    it('pendingCount is number', () => {
      expectTypeOf(result.pendingCount).toBeNumber();
    });

    it('lastError is unknown', () => {
      expectTypeOf(result.lastError).toBeUnknown();
    });
  });

  describe('setCallbacks — TResult propagation', () => {
    it('onSuccess parameter is narrowed to TResult({ saved: boolean })', () => {
      observer.setCallbacks({
        onSuccess: (result) => {
          // result should be inferred as { saved: boolean }
          expectTypeOf(result).toExtend<{ saved: boolean }>();
        },
      });
    });

    it('can be called without callbacks (optional)', () => {
      observer.setCallbacks();
    });
  });
});
