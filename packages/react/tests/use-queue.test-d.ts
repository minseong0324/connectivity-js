import { describe, expectTypeOf, it } from 'vitest';
import type { QueuedJob } from '@connectivity-js/core';
import { useQueue } from '../src/use-queue';

describe('useQueue', () => {
  describe('return value types', () => {
    const { jobs, pendingCount, retry, cancel } = useQueue();

    // jobs is QueuedJob array
    expectTypeOf(jobs).toExtend<QueuedJob[]>();

    // pendingCount is number of queued + running jobs, number type
    expectTypeOf(pendingCount).toBeNumber();

    // retry and cancel are functions that accept jobId (string)
    expectTypeOf(retry).toExtend<(jobId: string) => void>();
    expectTypeOf(cancel).toExtend<(jobId: string) => void>();
  });

  describe('filter parameter', () => {
    it('returns full queue when called without filter (filter is optional)', () => {
      useQueue();
    });

    it('can query only jobs for specific action with actionKey filter', () => {
      const { jobs } = useQueue({ actionKey: 'save' });
      expectTypeOf(jobs).toExtend<QueuedJob[]>();
    });
  });

  describe('type error cases', () => {
    it('type error when passing non-string to retry', () => {
      const { retry } = useQueue();
      // @ts-expect-error — jobId must be string type
      retry(42);
    });

    it('type error when passing non-string to cancel', () => {
      const { cancel } = useQueue();
      // @ts-expect-error — jobId must be string type
      cancel(42);
    });
  });
});
