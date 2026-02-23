import { describe, expect, test } from 'vitest';
import { actionOptions } from '../src/action-options';

describe('actionOptions', () => {
  test('입력 config를 그대로 반환한다 (identity function)', () => {
    const config = {
      actionKey: 'save',
      request: async (input: { id: string }) => ({ saved: true, id: input.id }),
      whenOffline: 'queue' as const,
    };
    expect(actionOptions(config)).toBe(config);
  });

  test('dedupeKey에서 input 타입이 request의 input과 동일하게 추론된다', () => {
    const opts = actionOptions({
      actionKey: 'save',
      request: async (_input: { designId: string; data: string }) => ({
        ok: true,
      }),
      dedupeKey: (input) => input.designId,
    });
    expect(opts.dedupeKey?.({ designId: 'd1', data: 'v1' })).toBe('d1');
  });

  test('모든 옵션 필드가 보존된다', () => {
    const opts = actionOptions({
      actionKey: 'upload',
      request: async (_input: { file: string }) => ({ url: 'https://...' }),
      whenOffline: 'queue',
      retry: { maxAttempts: 3, backoffMs: (n: number) => n * 1_000 },
      flushOption: { concurrency: 2, intervalMs: 500 },
      dedupeKey: (input) => input.file,
      dedupeOnFlush: 'keep-last',
    });
    expect(opts.actionKey).toBe('upload');
    expect(opts.whenOffline).toBe('queue');
    expect(opts.retry?.maxAttempts).toBe(3);
    expect(opts.flushOption?.concurrency).toBe(2);
    expect(opts.dedupeOnFlush).toBe('keep-last');
  });
});
