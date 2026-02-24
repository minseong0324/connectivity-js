import { describe, expect, test } from 'vitest';
import {
  DEFAULT_BACKOFF_MS,
  SUCCEEDED_JOB_CLEANUP_DELAY_MS,
} from '../src/engine-utils';

describe('engine-utils', () => {
  describe('상수', () => {
    test('SUCCEEDED_JOB_CLEANUP_DELAY_MS는 5초이다', () => {
      expect(SUCCEEDED_JOB_CLEANUP_DELAY_MS).toBe(5_000);
    });

    test('DEFAULT_BACKOFF_MS는 1초이다', () => {
      expect(DEFAULT_BACKOFF_MS).toBe(1_000);
    });
  });
});
