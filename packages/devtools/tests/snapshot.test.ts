import { describe, expect, test, vi } from 'vitest';
import type { ConnectivityState, QueuedJob } from '@connectivity-js/core';
import { createDevToolsSnapshot } from '../src/snapshot';

const BASE_STATE: ConnectivityState = {
  status: 'online',
  reason: 'test',
  since: Date.now() - 5000,
  quality: {},
};

const createJob = (overrides?: Partial<QueuedJob>): QueuedJob => ({
  id: 'job-1',
  actionKey: 'save',
  input: { text: 'hello' },
  createdAt: Date.now() - 3000,
  attempt: 1,
  status: 'queued' as const,
  ...overrides,
});

describe('createDevToolsSnapshot', () => {
  test('creates snapshot with state and empty queue', () => {
    const snap = createDevToolsSnapshot(BASE_STATE, []);

    expect(snap.state).toBe(BASE_STATE);
    expect(snap.queue).toEqual([]);
    expect(snap.queueDisplay).toEqual([]);
    expect(snap.stateSinceDisplay).toBeDefined();
  });

  test('stateSinceDisplay formats relative time', () => {
    const now = Date.now();
    const state: ConnectivityState = {
      ...BASE_STATE,
      since: now - 500,
    };

    const snap = createDevToolsSnapshot(state, []);
    expect(snap.stateSinceDisplay).toMatch(/ms$/);
  });

  test('stateSinceDisplay formats seconds', () => {
    const state: ConnectivityState = {
      ...BASE_STATE,
      since: Date.now() - 5000,
    };

    const snap = createDevToolsSnapshot(state, []);
    expect(snap.stateSinceDisplay).toMatch(/s$/);
  });

  test('stateSinceDisplay formats minutes', () => {
    const state: ConnectivityState = {
      ...BASE_STATE,
      since: Date.now() - 120_000,
    };

    const snap = createDevToolsSnapshot(state, []);
    expect(snap.stateSinceDisplay).toMatch(/s$/);
  });

  test('stateSinceDisplay formats hours', () => {
    const state: ConnectivityState = {
      ...BASE_STATE,
      since: Date.now() - 7_200_000,
    };

    const snap = createDevToolsSnapshot(state, []);
    expect(snap.stateSinceDisplay).toMatch(/h/);
  });

  test('maps queue jobs to display format', () => {
    const job = createJob({
      id: 'j-1',
      actionKey: 'upload',
      input: { file: 'doc.pdf' },
      attempt: 2,
      status: 'failed',
      lastError: new Error('timeout'),
    });

    const snap = createDevToolsSnapshot(BASE_STATE, [job]);

    expect(snap.queueDisplay).toHaveLength(1);
    const display = snap.queueDisplay[0];
    expect(display.id).toBe('j-1');
    expect(display.actionKey).toBe('upload');
    expect(display.attempt).toBe(2);
    expect(display.status).toBe('failed');
    expect(display.lastError).toBe('timeout');
    expect(display.inputDisplay).toContain('doc.pdf');
  });

  test('truncates long input display', () => {
    const longInput = { data: 'x'.repeat(200) };
    const job = createJob({ input: longInput });

    const snap = createDevToolsSnapshot(BASE_STATE, [job]);

    expect(snap.queueDisplay[0].inputDisplay.length).toBeLessThanOrEqual(83);
    expect(snap.queueDisplay[0].inputDisplay).toMatch(/\.\.\.$/);
  });

  test('handles undefined input', () => {
    const job = createJob({ input: undefined });
    const snap = createDevToolsSnapshot(BASE_STATE, [job]);

    expect(snap.queueDisplay[0].inputDisplay).toBe('—');
  });

  test('handles circular reference in input gracefully', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const job = createJob({ input: circular });

    const snap = createDevToolsSnapshot(BASE_STATE, [job]);
    expect(snap.queueDisplay[0].inputDisplay).toBeDefined();
  });

  test('handles non-Error lastError', () => {
    const job = createJob({ lastError: 'string error' as unknown });

    const snap = createDevToolsSnapshot(BASE_STATE, [job]);
    expect(snap.queueDisplay[0].lastError).toBe('string error');
  });

  test('job without lastError has undefined lastError in display', () => {
    const job = createJob({ lastError: undefined });

    const snap = createDevToolsSnapshot(BASE_STATE, [job]);
    expect(snap.queueDisplay[0].lastError).toBeUndefined();
  });
});
