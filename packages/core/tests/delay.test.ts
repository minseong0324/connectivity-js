import { describe, expect, test } from 'vitest';
import {
  DEFAULT_BACKOFF_MS,
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
});
