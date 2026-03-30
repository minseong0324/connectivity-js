import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  DEFAULT_BACKOFF_MS,
  delay,
  SUCCEEDED_JOB_CLEANUP_DELAY_MS,
} from '../src/utils/delay';

describe('delay', () => {
  describe('constants', () => {
    test('SUCCEEDED_JOB_CLEANUP_DELAY_MS is 5 seconds', () => {
      expect(SUCCEEDED_JOB_CLEANUP_DELAY_MS).toBe(5_000);
    });

    test('DEFAULT_BACKOFF_MS is 1 second', () => {
      expect(DEFAULT_BACKOFF_MS).toBe(1_000);
    });
  });

  describe('delay()', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test('resolves after the specified milliseconds', async () => {
      let resolved = false;
      const promise = delay(1000).then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);
      await vi.advanceTimersByTimeAsync(999);
      expect(resolved).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await promise;
      expect(resolved).toBe(true);
    });
  });
});
