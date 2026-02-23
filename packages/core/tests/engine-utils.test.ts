import { describe, expect, test } from 'vitest';
import {
  DEFAULT_BACKOFF_MS,
  SUCCEEDED_JOB_CLEANUP_DELAY_MS,
  toErrorMessage,
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

  describe('toErrorMessage', () => {
    test('Error 인스턴스에서 message를 추출한다', () => {
      expect(toErrorMessage(new Error('실패'))).toBe('실패');
    });

    test('Error가 아닌 값을 String으로 변환한다', () => {
      expect(toErrorMessage('문자열')).toBe('문자열');
      expect(toErrorMessage(42)).toBe('42');
      expect(toErrorMessage(null)).toBe('null');
    });
  });
});
