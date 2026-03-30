import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createDevToolsSnapshot } from '../src/snapshot';
import type { ConnectivityState, QueuedJob } from '@connectivity-js/core';

const BASE_TIME = 1_700_000_000_000;

function makeState(since: number): ConnectivityState {
  return {
    status: 'online',
    since,
    quality: {},
  };
}

function makeJob(overrides: Partial<QueuedJob> = {}): QueuedJob {
  return {
    id: 'job_1',
    actionKey: 'save',
    input: undefined,
    createdAt: BASE_TIME,
    attempt: 1,
    status: 'queued',
    ...overrides,
  };
}

describe('createDevToolsSnapshot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatRelativeTime via stateSinceDisplay', () => {
    test('under 1s → Xms format', () => {
      const state = makeState(BASE_TIME - 500);
      const { stateSinceDisplay } = createDevToolsSnapshot(state, []);
      expect(stateSinceDisplay).toBe('500ms');
    });

    test('exactly 999ms → Xms format', () => {
      const state = makeState(BASE_TIME - 999);
      const { stateSinceDisplay } = createDevToolsSnapshot(state, []);
      expect(stateSinceDisplay).toBe('999ms');
    });

    test('under 1min → X.Xs format', () => {
      const state = makeState(BASE_TIME - 5_000);
      const { stateSinceDisplay } = createDevToolsSnapshot(state, []);
      expect(stateSinceDisplay).toBe('5.0s');
    });

    test('under 1min fractional → X.Xs format', () => {
      const state = makeState(BASE_TIME - 12_500);
      const { stateSinceDisplay } = createDevToolsSnapshot(state, []);
      expect(stateSinceDisplay).toBe('12.5s');
    });

    test('under 1h → Xm Xs format', () => {
      const state = makeState(BASE_TIME - 90_000);
      const { stateSinceDisplay } = createDevToolsSnapshot(state, []);
      expect(stateSinceDisplay).toBe('1m 30s');
    });

    test('under 1h with zero seconds → Xm 0s format', () => {
      const state = makeState(BASE_TIME - 120_000);
      const { stateSinceDisplay } = createDevToolsSnapshot(state, []);
      expect(stateSinceDisplay).toBe('2m 0s');
    });

    test('over 1h → Xh Xm format', () => {
      const state = makeState(BASE_TIME - 3_690_000);
      const { stateSinceDisplay } = createDevToolsSnapshot(state, []);
      expect(stateSinceDisplay).toBe('1h 1m');
    });

    test('over 1h with zero minutes → Xh 0m format', () => {
      const state = makeState(BASE_TIME - 7_200_000);
      const { stateSinceDisplay } = createDevToolsSnapshot(state, []);
      expect(stateSinceDisplay).toBe('2h 0m');
    });
  });

  describe('formatRelativeTime via sinceDisplay on queue jobs', () => {
    test('job sinceDisplay reflects job createdAt relative time', () => {
      const state = makeState(BASE_TIME);
      const job = makeJob({ createdAt: BASE_TIME - 3_000 });
      const { queueDisplay } = createDevToolsSnapshot(state, [job]);
      expect(queueDisplay[0].sinceDisplay).toBe('3.0s');
    });
  });

  describe('serializeInput via inputDisplay', () => {
    test('undefined input → "—"', () => {
      const state = makeState(BASE_TIME);
      const job = makeJob({ input: undefined });
      const { queueDisplay } = createDevToolsSnapshot(state, [job]);
      expect(queueDisplay[0].inputDisplay).toBe('—');
    });

    test('simple object → JSON string', () => {
      const state = makeState(BASE_TIME);
      const job = makeJob({ input: { id: '1' } });
      const { queueDisplay } = createDevToolsSnapshot(state, [job]);
      expect(queueDisplay[0].inputDisplay).toBe('{"id":"1"}');
    });

    test('long JSON (over 80 chars) → truncated with "..."', () => {
      const state = makeState(BASE_TIME);
      const longInput = { data: 'x'.repeat(100) };
      const job = makeJob({ input: longInput });
      const { queueDisplay } = createDevToolsSnapshot(state, [job]);
      const display = queueDisplay[0].inputDisplay;
      expect(display.endsWith('...')).toBe(true);
      expect(display.length).toBe(83);
    });

    test('JSON at exactly 80 chars → not truncated', () => {
      const state = makeState(BASE_TIME);
      const str = 'x'.repeat(78);
      const job = makeJob({ input: str });
      const { queueDisplay } = createDevToolsSnapshot(state, [job]);
      const display = queueDisplay[0].inputDisplay;
      expect(display.endsWith('...')).toBe(false);
      expect(display.length).toBe(80);
    });

    test('circular reference → String(input)', () => {
      const state = makeState(BASE_TIME);
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const job = makeJob({ input: circular });
      const { queueDisplay } = createDevToolsSnapshot(state, [job]);
      expect(queueDisplay[0].inputDisplay).toBe(String(circular));
    });

    test('Symbol input (JSON.stringify returns undefined) → "—"', () => {
      const state = makeState(BASE_TIME);
      const job = makeJob({ input: Symbol('test') });
      const { queueDisplay } = createDevToolsSnapshot(state, [job]);
      expect(queueDisplay[0].inputDisplay).toBe('—');
    });
  });

  describe('errorToString via lastError', () => {
    test('Error object → error.message', () => {
      const state = makeState(BASE_TIME);
      const job = makeJob({ lastError: new Error('something failed') });
      const { queueDisplay } = createDevToolsSnapshot(state, [job]);
      expect(queueDisplay[0].lastError).toBe('something failed');
    });

    test('string error → string itself', () => {
      const state = makeState(BASE_TIME);
      const job = makeJob({ lastError: 'network timeout' });
      const { queueDisplay } = createDevToolsSnapshot(state, [job]);
      expect(queueDisplay[0].lastError).toBe('network timeout');
    });

    test('no lastError → undefined', () => {
      const state = makeState(BASE_TIME);
      const job = makeJob({ lastError: undefined });
      const { queueDisplay } = createDevToolsSnapshot(state, [job]);
      expect(queueDisplay[0].lastError).toBeUndefined();
    });
  });

  describe('createDevToolsSnapshot structure', () => {
    test('returns correct state reference', () => {
      const state = makeState(BASE_TIME);
      const snapshot = createDevToolsSnapshot(state, []);
      expect(snapshot.state).toBe(state);
    });

    test('queueDisplay length matches queue length', () => {
      const state = makeState(BASE_TIME);
      const jobs = [
        makeJob({ id: 'job_1' }),
        makeJob({ id: 'job_2', actionKey: 'delete' }),
      ];
      const snapshot = createDevToolsSnapshot(state, jobs);
      expect(snapshot.queueDisplay.length).toBe(jobs.length);
    });

    test('queue reference is preserved', () => {
      const state = makeState(BASE_TIME);
      const jobs = [makeJob()];
      const snapshot = createDevToolsSnapshot(state, jobs);
      expect(snapshot.queue).toBe(jobs);
    });

    test('job fields are correctly mapped in queueDisplay', () => {
      const state = makeState(BASE_TIME);
      const job = makeJob({
        id: 'job_42',
        actionKey: 'upload',
        dedupeKey: 'upload:file1',
        input: { file: 'a.txt' },
        createdAt: BASE_TIME - 1_000,
        attempt: 3,
        nextRunAt: BASE_TIME + 5_000,
        status: 'failed',
        lastError: new Error('upload failed'),
      });
      const { queueDisplay } = createDevToolsSnapshot(state, [job]);
      const display = queueDisplay[0];

      expect(display.id).toBe('job_42');
      expect(display.actionKey).toBe('upload');
      expect(display.dedupeKey).toBe('upload:file1');
      expect(display.inputDisplay).toBe('{"file":"a.txt"}');
      expect(display.createdAt).toBe(BASE_TIME - 1_000);
      expect(display.sinceDisplay).toBe('1.0s');
      expect(display.attempt).toBe(3);
      expect(display.nextRunAt).toBe(BASE_TIME + 5_000);
      expect(display.status).toBe('failed');
      expect(display.lastError).toBe('upload failed');
    });
  });
});
