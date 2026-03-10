import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { actionOptions } from '../src/action-options';
import {
  ConnectivityClient,
  getConnectivityClient,
} from '../src/connectivity-client';
import type { Detector, DetectorEvent } from '../src/types';

const createMockDetector = () => {
  let listener: ((event: DetectorEvent) => void) | null = null;
  const detector: Detector = {
    start: (l) => {
      listener = l;
      return () => {
        listener = null;
      };
    },
  };
  const emit = (event: DetectorEvent) => {
    listener?.(event);
  };
  return { detector, emit };
};

const createTestClient = (options?: {
  gracePeriodMs?: number;
  onJobError?: (error: unknown, job: unknown) => void;
}) => {
  const mock = createMockDetector();
  const client = getConnectivityClient({
    detectors: [mock.detector],
    gracePeriodMs: options?.gracePeriodMs,
    onJobError: options?.onJobError,
  });
  client.start();
  return { client, mock };
};

describe('ConnectivityClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    ConnectivityClient.resetInstance();
  });

  describe('singleton', () => {
    test('getInstance() returns the same instance', () => {
      const a = ConnectivityClient.getInstance({ detectors: [] });
      const b = ConnectivityClient.getInstance();
      expect(a).toBe(b);
    });

    test('new instance is created after resetInstance()', () => {
      const a = ConnectivityClient.getInstance({ detectors: [] });
      ConnectivityClient.resetInstance();
      const b = ConnectivityClient.getInstance({ detectors: [] });
      expect(a).not.toBe(b);
    });

    test('getConnectivityClient() equals getInstance()', () => {
      const a = getConnectivityClient({ detectors: [] });
      const b = getConnectivityClient();
      expect(a).toBe(b);
    });
  });

  describe('state management', () => {
    test('initial status is unknown', () => {
      expect(getConnectivityClient({ detectors: [] }).getState().status).toBe(
        'unknown',
      );
    });

    test('initial status can be set via initialStatus', () => {
      expect(
        getConnectivityClient({
          detectors: [],
          initialStatus: 'offline',
        }).getState().status,
      ).toBe('offline');
    });

    test('listener receives state and transition when detector status changes', () => {
      const { client, mock } = createTestClient();
      const listener = vi.fn();
      client.subscribe(listener);
      mock.emit({ status: 'online', reason: 'test' });
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'online' }),
        expect.objectContaining({ from: 'unknown', to: 'online' }),
      );
    });

    test('listener is not called for same status change', () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });
      const listener = vi.fn();
      client.subscribe(listener);
      mock.emit({ status: 'online', reason: 'test' });
      expect(listener).not.toHaveBeenCalled();
    });

    test('getState() returns same reference', () => {
      const m = getConnectivityClient({ detectors: [] });
      expect(m.getState()).toBe(m.getState());
    });

    test('returns new reference after status change', () => {
      const { client, mock } = createTestClient();
      const before = client.getState();
      mock.emit({ status: 'online', reason: 'test' });
      expect(client.getState()).not.toBe(before);
    });
  });

  describe('grace period', () => {
    test('offline transition is ignored when recovery within gracePeriodMs', () => {
      const { client, mock } = createTestClient({ gracePeriodMs: 3_000 });
      mock.emit({ status: 'online', reason: 'test' });
      const listener = vi.fn();
      client.subscribe(listener);
      mock.emit({ status: 'offline', reason: 'test' });
      vi.advanceTimersByTime(2_000);
      mock.emit({ status: 'online', reason: 'test' });
      vi.advanceTimersByTime(2_000);
      expect(client.getState().status).toBe('online');
    });

    test('offline transition executes when gracePeriodMs exceeds', () => {
      const { client, mock } = createTestClient({ gracePeriodMs: 3_000 });
      mock.emit({ status: 'online', reason: 'test' });
      mock.emit({ status: 'offline', reason: 'test' });
      vi.advanceTimersByTime(3_000);
      expect(client.getState().status).toBe('offline');
    });

    test('second offline event reason during grace period is reflected in commit', () => {
      const { client, mock } = createTestClient({ gracePeriodMs: 3_000 });
      mock.emit({ status: 'online', reason: 'navigator' });
      mock.emit({ status: 'offline', reason: 'first-reason' });
      vi.advanceTimersByTime(1_000);
      mock.emit({ status: 'offline', reason: 'second-reason' });
      vi.advanceTimersByTime(2_000);
      expect(client.getState().status).toBe('offline');
      expect(client.getState().reason).toBe('second-reason');
    });

    test('pendingGraceReason is reset when grace period is cancelled', () => {
      const { client, mock } = createTestClient({ gracePeriodMs: 3_000 });
      mock.emit({ status: 'online', reason: 'navigator' });
      mock.emit({ status: 'offline', reason: 'first-reason' });
      vi.advanceTimersByTime(1_000);
      mock.emit({ status: 'online', reason: 'recovery' });
      mock.emit({ status: 'offline', reason: 'new-reason' });
      vi.advanceTimersByTime(3_000);
      expect(client.getState().status).toBe('offline');
      expect(client.getState().reason).toBe('new-reason');
    });
  });

  describe('quality', () => {
    test('quality info is reflected', () => {
      const { client, mock } = createTestClient();
      mock.emit({
        status: 'online',
        reason: 'hb',
        quality: { rttMs: 50, effectiveType: '4g' },
      });
      expect(client.getState().quality.rttMs).toBe(50);
    });

    test('initial quality is empty object', () => {
      expect(
        getConnectivityClient({ detectors: [] }).getState().quality,
      ).toEqual({});
    });
  });

  describe('enqueue dedupe', () => {
    test('same dedupeKey + queued → input replaced', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      client.registerAction('save', {
        request: vi.fn(),
        options: {
          whenOffline: 'queue',
          dedupeKey: (input) => String((input as { id: string }).id),
        },
      });
      const r1 = await client.execute('save', { id: 'a', data: 'v1' });
      const r2 = await client.execute('save', { id: 'a', data: 'v2' });
      if (r1.enqueued && r2.enqueued) {
        expect(r1.jobId).toBe(r2.jobId);
      }
      const firstJob = client.getQueue()[0];
      assert(firstJob !== undefined);
      expect(firstJob.input).toEqual({ id: 'a', data: 'v2' });
    });

    test('same dedupeKey + running → new job', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });
      let resolve: ((v: unknown) => void) | undefined;
      client.registerAction('save', {
        request: () =>
          new Promise((r) => {
            resolve = r;
          }),
        options: { dedupeKey: (input) => String((input as { id: string }).id) },
      });
      const p1 = client.execute('save', { id: 'a', data: 'v1' });
      const r2 = await client.execute('save', { id: 'a', data: 'v2' });
      expect(r2.enqueued).toBe(true);
      expect(
        client.getQueue().filter((j) => j.status === 'running'),
      ).toHaveLength(1);
      expect(
        client.getQueue().filter((j) => j.status === 'queued'),
      ).toHaveLength(1);
      resolve?.('ok');
      await p1;
    });

    test('no dedupeKey → always new job', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      client.registerAction('log', {
        request: vi.fn(),
        options: { whenOffline: 'queue' },
      });
      const r1 = await client.execute('log', { msg: 'a' });
      const r2 = await client.execute('log', { msg: 'b' });
      if (r1.enqueued && r2.enqueued) {
        expect(r1.jobId).not.toBe(r2.jobId);
      }
    });

    test('same dedupeKey + queued → attempt/createdAt reset', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      client.registerAction('save', {
        request: vi.fn(),
        options: {
          whenOffline: 'queue',
          dedupeKey: (input) => String((input as { id: string }).id),
        },
      });
      await client.execute('save', { id: 'a', data: 'v1' });
      const job1 = client.getQueue()[0];
      assert(job1 !== undefined);
      const createdAt1 = job1.createdAt;
      vi.advanceTimersByTime(100);
      await client.execute('save', { id: 'a', data: 'v2' });
      const job = client.getQueue()[0];
      assert(job !== undefined);
      expect(job.attempt).toBe(0);
      expect(job.createdAt).toBeGreaterThan(createdAt1);
    });

    test('no dedupeKey + same input → still new job', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      client.registerAction('log', {
        request: vi.fn(),
        options: { whenOffline: 'queue' },
      });
      const r1 = await client.execute('log', { msg: 'same' });
      const r2 = await client.execute('log', { msg: 'same' });
      if (r1.enqueued && r2.enqueued) {
        expect(r1.jobId).not.toBe(r2.jobId);
      }
      expect(client.getQueue()).toHaveLength(2);
    });
  });

  describe('state management — transition', () => {
    test('transition.duration reflects elapsed time', () => {
      const { client, mock } = createTestClient();
      const listener = vi.fn();
      mock.emit({ status: 'online', reason: 'test' });
      client.subscribe(listener);
      vi.advanceTimersByTime(5_000);
      mock.emit({ status: 'offline', reason: 'test' });
      const call = listener.mock.calls[0];
      assert(call !== undefined);
      const transition = call[1];
      expect(transition.from).toBe('online');
      expect(transition.to).toBe('offline');
      expect(transition.duration).toBeGreaterThanOrEqual(5_000);
    });
  });

  describe('always-enqueue — online', () => {
    test('immediate execution + result return', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });
      const fn = vi.fn().mockResolvedValue({ id: '1' });
      client.registerAction('t', { request: fn, options: {} });
      const r = await client.execute('t', {});
      expect(r.enqueued).toBe(false);
      if (!r.enqueued) {
        expect(r.result).toEqual({ id: '1' });
      }
    });

    test('job status changes in running → succeeded order', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });
      const statusHistory: string[] = [];
      let resolve: ((v: unknown) => void) | undefined;
      client.registerAction('t', {
        request: () =>
          new Promise((r) => {
            resolve = r;
          }),
        options: {},
      });
      client.subscribeQueue(() => {
        const jobs = client.getQueue();
        const job = jobs.find((j) => j.actionKey === 't');
        if (job !== undefined) {
          statusHistory.push(job.status);
        }
      });
      const p = client.execute('t', {});
      expect(statusHistory).toContain('running');
      resolve?.('ok');
      await p;
      expect(statusHistory).toContain('succeeded');
    });

    test('job is removed 5 seconds after succeeded', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });
      client.registerAction('t', {
        request: vi.fn().mockResolvedValue('ok'),
        options: {},
      });
      await client.execute('t', {});
      const job = client.getQueue().find((j) => j.status === 'succeeded');
      expect(job).toBeDefined();
      vi.advanceTimersByTime(5_000);
      expect(client.getQueue().find((j) => j.id === job?.id)).toBeUndefined();
    });
  });

  describe('hasRunningDupe', () => {
    test('same dedupeKey running → enqueued', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });
      let resolve: ((v: unknown) => void) | undefined;
      client.registerAction('s', {
        request: () =>
          new Promise((r) => {
            resolve = r;
          }),
        options: { dedupeKey: (input) => String((input as { id: string }).id) },
      });
      const p1 = client.execute('s', { id: 'a' });
      const r2 = await client.execute('s', { id: 'a' });
      expect(r2.enqueued).toBe(true);
      resolve?.('ok');
      await p1;
    });

    test('different action running + new request → immediate execution', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });
      let resolve: ((v: unknown) => void) | undefined;
      client.registerAction('save', {
        request: () =>
          new Promise((r) => {
            resolve = r;
          }),
        options: { dedupeKey: (input) => String((input as { id: string }).id) },
      });
      client.registerAction('like', {
        request: vi.fn().mockResolvedValue('liked'),
        options: { dedupeKey: (input) => String((input as { id: string }).id) },
      });
      const p1 = client.execute('save', { id: 'a' });
      const r2 = await client.execute('like', { id: 'a' });
      expect(r2.enqueued).toBe(false);
      resolve?.('ok');
      await p1;
    });

    test('action without dedupeKey + running → immediate execution', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });
      let resolve: ((v: unknown) => void) | undefined;
      client.registerAction('log', {
        request: (input) => {
          if ((input as { msg: string }).msg === 'first') {
            return new Promise((r) => {
              resolve = r;
            });
          }
          return Promise.resolve('fast');
        },
        options: {},
      });
      const p1 = client.execute('log', { msg: 'first' });
      const r2 = await client.execute('log', { msg: 'second' });
      expect(r2.enqueued).toBe(false);
      if (!r2.enqueued) {
        expect(r2.result).toBe('fast');
      }
      resolve?.('ok');
      await p1;
    });

    test('different dedupeKey running → immediate execution', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });
      let resolve: ((v: unknown) => void) | undefined;
      client.registerAction('s', {
        request: (input) => {
          if ((input as { id: string }).id === 'a') {
            return new Promise((r) => {
              resolve = r;
            });
          }
          return Promise.resolve('fast');
        },
        options: { dedupeKey: (input) => String((input as { id: string }).id) },
      });
      const p1 = client.execute('s', { id: 'a' });
      const r2 = await client.execute('s', { id: 'b' });
      expect(r2.enqueued).toBe(false);
      resolve?.('ok');
      await p1;
    });
  });

  describe('offline + queueing', () => {
    test('offline + queue → stored in queue', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      const fn = vi.fn();
      client.registerAction('t', {
        request: fn,
        options: { whenOffline: 'queue' },
      });
      const r = await client.execute('t', {});
      expect(fn).not.toHaveBeenCalled();
      expect(r.enqueued).toBe(true);
    });

    test('offline + fail → throw', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      client.registerAction('t', {
        request: vi.fn(),
        options: { whenOffline: 'fail' },
      });
      await expect(client.execute('t', {})).rejects.toThrow(
        "whenOffline='fail'",
      );
    });

    test('auto flush when back online', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      const fn = vi.fn().mockResolvedValue('ok');
      client.registerAction('t', {
        request: fn,
        options: { whenOffline: 'queue' },
      });
      await client.execute('t', {});
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledOnce();
    });
  });

  describe('failure + retry', () => {
    test('retry possible → queued', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });
      client.registerAction('t', {
        request: vi.fn().mockRejectedValue(new Error('err')),
        options: { retry: { maxAttempts: 3, backoffMs: (n) => n * 1_000 } },
      });
      const r = await client.execute('t', {});
      expect(r.enqueued).toBe(true);
      const queuedJob = client.getQueue()[0];
      assert(queuedJob !== undefined);
      expect(queuedJob.status).toBe('queued');
    });

    test('retry impossible → failed + throw', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });
      client.registerAction('t', {
        request: vi.fn().mockRejectedValue(new Error('fatal')),
        options: {},
      });
      await expect(client.execute('t', {})).rejects.toThrow('fatal');
    });

    test('stale retry cancel', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });
      const received: unknown[] = [];
      let callCount = 0;
      client.registerAction('s', {
        request: (input) => {
          callCount++;
          received.push(input);
          if (callCount === 1) {
            return Promise.reject(new Error('err'));
          }
          return Promise.resolve('ok');
        },
        options: {
          retry: { maxAttempts: 3, backoffMs: () => 2_000 },
          dedupeKey: (input) => String((input as { id: string }).id),
        },
      });
      const p1 = client.execute('s', { id: 'a', data: 'v1' });
      await client.execute('s', { id: 'a', data: 'v2' });
      await p1;
      await vi.advanceTimersByTimeAsync(3_000);
      const successful = received.filter((_, i) => i > 0);
      expect(successful).toHaveLength(1);
      expect(successful[0]).toEqual({ id: 'a', data: 'v2' });
    });

    test('retry exhausted → onJobError', async () => {
      const onJobError = vi.fn();
      const { client, mock } = createTestClient({ onJobError });
      mock.emit({ status: 'offline', reason: 'test' });
      client.registerAction('t', {
        request: vi.fn().mockRejectedValue(new Error('err')),
        options: {
          whenOffline: 'queue',
          retry: { maxAttempts: 1, backoffMs: () => 0 },
        },
      });
      await client.execute('t', {});
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);
      expect(onJobError).toHaveBeenCalledOnce();
    });
  });

  describe('flush integration', () => {
    test('queue is processed by flush after immediate execution', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });
      const order: string[] = [];
      let resolve: ((v: unknown) => void) | undefined;
      client.registerAction('s', {
        request: (input) => {
          const d = (input as { data: string }).data;
          if (d === 'v1') {
            return new Promise((r) => {
              resolve = r;
            });
          }
          order.push(d);
          return Promise.resolve('ok');
        },
        options: { dedupeKey: (input) => String((input as { id: string }).id) },
      });
      const p1 = client.execute('s', { id: 'a', data: 'v1' });
      await client.execute('s', { id: 'a', data: 'v2' });
      resolve?.('ok');
      await p1;
      await vi.advanceTimersByTimeAsync(0);
      expect(order).toContain('v2');
    });

    test('flush same entity → hasRunningDupe → enqueued → while loop processes', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      let callCount = 0;
      let resolveSecond: ((v: unknown) => void) | undefined;
      const inputs: unknown[] = [];
      client.registerAction('s', {
        request: (input) => {
          callCount++;
          inputs.push(input);
          if (callCount === 1) {
            return new Promise((r) => {
              resolveSecond = r;
            });
          }
          return Promise.resolve('ok');
        },
        options: {
          whenOffline: 'queue',
          dedupeKey: (input) => String((input as { id: string }).id),
        },
      });
      await client.execute('s', { id: 'a', data: 'v1' });
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);
      const r2 = await client.execute('s', { id: 'a', data: 'v2' });
      expect(r2.enqueued).toBe(true);
      resolveSecond?.('ok');
      await vi.advanceTimersByTimeAsync(0);
      expect(inputs).toHaveLength(2);
      expect(inputs[1]).toEqual({ id: 'a', data: 'v2' });
    });

    test('flush different entity → immediate execution', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      let resolve: ((v: unknown) => void) | undefined;
      client.registerAction('s', {
        request: (input) => {
          if ((input as { id: string }).id === 'a') {
            return new Promise((r) => {
              resolve = r;
            });
          }
          return Promise.resolve('ok');
        },
        options: {
          whenOffline: 'queue',
          dedupeKey: (input) => String((input as { id: string }).id),
        },
      });
      await client.execute('s', { id: 'a', data: 'v1' });
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);
      const r2 = await client.execute('s', { id: 'b', data: 'v1' });
      expect(r2.enqueued).toBe(false);
      resolve?.('ok');
      await vi.advanceTimersByTimeAsync(0);
    });

    test('flush new action key → outer while loop processes', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      const order: string[] = [];
      client.registerAction('a', {
        request: async (input) => {
          order.push(`a:${(input as { name: string }).name}`);
          // add actionB to queue directly during actionA processing (during flush)
        },
        options: { whenOffline: 'queue' },
      });
      client.registerAction('b', {
        request: async (input) => {
          order.push(`b:${(input as { name: string }).name}`);
        },
        options: { whenOffline: 'queue' },
      });
      await client.execute('a', { name: '1' });
      mock.emit({ status: 'online', reason: 'test' });
      // add actionB to queue before actionA flush starts
      await client.execute('b', { name: '1' });
      await vi.advanceTimersByTimeAsync(0);
      expect(order).toContain('a:1');
      expect(order).toContain('b:1');
    });
  });

  describe('input replacement during retry', () => {
    test('same entity save during retry wait → input replaced then latest sent', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });
      let callCount = 0;
      const inputs: unknown[] = [];
      client.registerAction('s', {
        request: (input) => {
          callCount++;
          inputs.push(input);
          if (callCount === 1) {
            return Promise.reject(new Error('err'));
          }
          return Promise.resolve('ok');
        },
        options: {
          retry: { maxAttempts: 3, backoffMs: () => 2_000 },
          dedupeKey: (input) => String((input as { id: string }).id),
        },
      });
      const r1 = await client.execute('s', { id: 'a', data: 'v1' });
      expect(r1.enqueued).toBe(true);
      await client.execute('s', { id: 'a', data: 'v2' });
      await vi.advanceTimersByTimeAsync(3_000);
      expect(inputs.length).toBeGreaterThanOrEqual(2);
      expect(inputs[inputs.length - 1]).toEqual({ id: 'a', data: 'v2' });
    });
  });

  describe('defaultOptions', () => {
    test('defaultOptions.actions.whenOffline is applied as default', async () => {
      const mock = createMockDetector();
      const client = getConnectivityClient({
        detectors: [mock.detector],
        defaultOptions: { actions: { whenOffline: 'fail' } },
      });
      client.start();
      mock.emit({ status: 'offline', reason: 'test' });
      client.registerAction('t', { request: vi.fn(), options: {} });
      await expect(client.execute('t', {})).rejects.toThrow(
        "whenOffline='fail'",
      );
    });

    test('action option overrides defaultOptions', async () => {
      const mock = createMockDetector();
      const client = getConnectivityClient({
        detectors: [mock.detector],
        defaultOptions: { actions: { whenOffline: 'fail' } },
      });
      client.start();
      mock.emit({ status: 'offline', reason: 'test' });
      client.registerAction('t', {
        request: vi.fn(),
        options: { whenOffline: 'queue' },
      });
      const r = await client.execute('t', {});
      expect(r.enqueued).toBe(true);
    });
  });

  describe('FIFO ordering', () => {
    test('job with earlier createdAt runs first', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      const order: string[] = [];
      client.registerAction('t', {
        request: async (input) => {
          order.push((input as { name: string }).name);
        },
        options: { whenOffline: 'queue', flushOption: { concurrency: 1 } },
      });
      await client.execute('t', { name: 'first' });
      vi.advanceTimersByTime(10);
      await client.execute('t', { name: 'second' });
      vi.advanceTimersByTime(10);
      await client.execute('t', { name: 'third' });
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);
      expect(order).toEqual(['first', 'second', 'third']);
    });
  });

  describe('concurrency', () => {
    test('concurrent execution limited to 2 when concurrency=2', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      let running = 0;
      let maxRunning = 0;
      client.registerAction('t', {
        request: async () => {
          running++;
          maxRunning = Math.max(maxRunning, running);
          await new Promise((r) => setTimeout(r, 10));
          running--;
        },
        options: { whenOffline: 'queue', flushOption: { concurrency: 2 } },
      });
      await client.execute('t', { id: '1' });
      await client.execute('t', { id: '2' });
      await client.execute('t', { id: '3' });
      await client.execute('t', { id: '4' });
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(100);
      expect(maxRunning).toBeLessThanOrEqual(2);
    });
  });

  describe('dedupeOnFlush', () => {
    test('only last job runs when keep-last', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      const fn = vi.fn().mockResolvedValue('ok');
      client.registerAction('t', {
        request: fn,
        options: {
          whenOffline: 'queue',
          dedupeKey: (input) => String((input as { id: string }).id),
          dedupeOnFlush: 'keep-last',
        },
      });
      // same dedupeKey leaves only 1 via enqueue dedupe; dedupeOnFlush matters when running→fail→queued yields 2
      await client.execute('t', { id: 'a', data: 'v1' });
      await client.execute('t', { id: 'a', data: 'v2' }); // dedupe: v1 → v2 replaced
      expect(client.getQueue()).toHaveLength(1);
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledOnce();
      expect(fn).toHaveBeenCalledWith({ id: 'a', data: 'v2' });
    });

    test('only first job runs when keep-first', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      const fn = vi.fn().mockResolvedValue('ok');
      client.registerAction('t', {
        request: fn,
        options: {
          whenOffline: 'queue',
          dedupeKey: (input) => String((input as { id: string }).id),
          dedupeOnFlush: 'keep-first',
        },
      });
      // same dedupeKey + queued → enqueue dedupe runs first → only 1 remains
      // dedupeOnFlush only matters when passing enqueue dedupe
      await client.execute('t', { id: 'a', data: 'v1' });
      await client.execute('t', { id: 'a', data: 'v2' }); // input replaced
      expect(client.getQueue()).toHaveLength(1);
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledOnce();
    });
  });

  describe('cancel / destroy', () => {
    test('cancel job via cancel', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      client.registerAction('t', {
        request: vi.fn(),
        options: { whenOffline: 'queue' },
      });
      const r = await client.execute('t', {});
      if (!r.enqueued) {
        return;
      }
      client.cancel(r.jobId);
      expect(client.getQueue().find((j) => j.id === r.jobId)?.status).toBe(
        'canceled',
      );
    });

    test('unregistered action → throw', async () => {
      getConnectivityClient({ detectors: [] });
      await expect(getConnectivityClient().execute('x', {})).rejects.toThrow(
        'is not registered',
      );
    });

    test('listener not called after destroy', () => {
      const { client, mock } = createTestClient();
      const listener = vi.fn();
      client.subscribe(listener);
      client.destroy();
      mock.emit({ status: 'online', reason: 'test' });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('per-action queue', () => {
    test('getActionQueue returns only that action', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      client.registerAction('a', {
        request: vi.fn(),
        options: { whenOffline: 'queue' },
      });
      client.registerAction('b', {
        request: vi.fn(),
        options: { whenOffline: 'queue' },
      });
      await client.execute('a', {});
      await client.execute('b', {});
      await client.execute('a', {});
      expect(client.getActionQueue('a')).toHaveLength(2);
      expect(client.getActionQueue('b')).toHaveLength(1);
    });

    test('reference preserved when other action changes', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      client.registerAction('a', {
        request: vi.fn(),
        options: { whenOffline: 'queue' },
      });
      client.registerAction('b', {
        request: vi.fn(),
        options: { whenOffline: 'queue' },
      });
      await client.execute('a', {});
      const snap1 = client.getActionQueue('a');
      await client.execute('b', {});
      expect(client.getActionQueue('a')).toBe(snap1);
    });
  });

  describe('end-to-end', () => {
    test('offline → online flush same entity execution → order preserved', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      const order: string[] = [];
      let resolve: ((v: unknown) => void) | undefined;
      client.registerAction('s', {
        request: (input) => {
          const d = (input as { data: string }).data;
          order.push(d);
          if (d === 'v1') {
            return new Promise((r) => {
              resolve = r;
            });
          }
          return Promise.resolve('ok');
        },
        options: {
          whenOffline: 'queue',
          dedupeKey: (input) => String((input as { id: string }).id),
        },
      });
      await client.execute('s', { id: '1', data: 'v1' });
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);
      const r2 = await client.execute('s', { id: '1', data: 'v2' });
      expect(r2.enqueued).toBe(true);
      resolve?.('ok');
      await vi.advanceTimersByTimeAsync(0);
      expect(order).toEqual(['v1', 'v2']);
    });

    test('offline different action queueing → online flush → then immediate execution', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      const saveFn = vi.fn().mockResolvedValue('saved');
      const likeFn = vi.fn().mockResolvedValue('liked');
      client.registerAction('save', {
        request: saveFn,
        options: {
          whenOffline: 'queue',
          dedupeKey: (input) => String((input as { id: string }).id),
        },
      });
      client.registerAction('like', {
        request: likeFn,
        options: { whenOffline: 'queue' },
      });
      await client.execute('save', { id: '1', data: 'content' });
      await client.execute('like', { itemId: '1' });
      expect(client.getQueue()).toHaveLength(2);
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);
      expect(saveFn).toHaveBeenCalledOnce();
      expect(likeFn).toHaveBeenCalledOnce();
      const r3 = await client.execute('like', { itemId: '2' });
      expect(r3.enqueued).toBe(false);
      expect(likeFn).toHaveBeenCalledTimes(2);
    });

    test('offline dedupe → online → only latest sent', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      const fn = vi.fn().mockResolvedValue('ok');
      client.registerAction('s', {
        request: fn,
        options: {
          whenOffline: 'queue',
          dedupeKey: (input) => String((input as { id: string }).id),
        },
      });
      await client.execute('s', { id: '1', data: 'v1' });
      await client.execute('s', { id: '1', data: 'v2' });
      await client.execute('s', { id: '1', data: 'v3' });
      expect(client.getQueue()).toHaveLength(1);
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledWith({ id: '1', data: 'v3' });
    });

    test('online consecutive execution → dedupe → only final reaches', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });
      const received: unknown[] = [];
      const resolvers: Array<(v: unknown) => void> = [];
      client.registerAction('s', {
        request: (input) => {
          received.push(input);
          return new Promise((r) => {
            resolvers.push(r);
          });
        },
        options: { dedupeKey: (input) => String((input as { id: string }).id) },
      });
      const p1 = client.execute('s', { id: '1', data: 'v1' });
      await client.execute('s', { id: '1', data: 'v2' });
      await client.execute('s', { id: '1', data: 'v3' });
      resolvers[0]?.('ok');
      await p1;
      await vi.advanceTimersByTimeAsync(0);
      expect(received).toHaveLength(2);
      expect(received[1]).toEqual({ id: '1', data: 'v3' });
      resolvers[1]?.('ok');
      await vi.advanceTimersByTimeAsync(0);
    });
  });

  // ═══════════════════════════════════════════
  // Edge cases
  // ═══════════════════════════════════════════

  describe('edge cases', () => {
    test('calling start() twice → detector is not double-registered', () => {
      const { client, mock } = createTestClient();
      const listener = vi.fn();
      client.subscribe(listener);

      // start() already called once in createTestClient — second is ignored
      client.start();

      mock.emit({ status: 'online', reason: 'test' });
      expect(listener).toHaveBeenCalledOnce();
    });

    test('immediate unsubscribe after subscribe → listener is not called', () => {
      const { client, mock } = createTestClient();
      const listener = vi.fn();
      const unsub = client.subscribe(listener);
      unsub();

      mock.emit({ status: 'online', reason: 'test' });
      expect(listener).not.toHaveBeenCalled();
    });

    test('immediate unsubscribe after subscribeQueue → listener is not called', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      client.registerAction('t', {
        request: vi.fn(),
        options: { whenOffline: 'queue' },
      });

      const listener = vi.fn();
      const unsub = client.subscribeQueue(listener);
      unsub();

      await client.execute('t', {});
      expect(listener).not.toHaveBeenCalled();
    });

    test('cancel with nonexistent jobId → ignored without error', () => {
      getConnectivityClient({ detectors: [] });
      expect(() => getConnectivityClient().cancel('nonexistent')).not.toThrow();
    });

    test('retry with nonexistent jobId → ignored without error', async () => {
      getConnectivityClient({ detectors: [] });
      await expect(
        getConnectivityClient().retry('nonexistent'),
      ).resolves.toBeUndefined();
    });

    test('unknown + whenOffline=fail → queue instead of throw', async () => {
      // unknown is not confirmed offline, so conservatively queue instead of throw
      const { client } = createTestClient();
      // initialStatus is 'unknown' and no detector emit → unknown maintained
      client.registerAction('t', {
        request: vi.fn(),
        options: { whenOffline: 'fail' },
      });
      const r = await client.execute('t', {});
      expect(r.enqueued).toBe(true);
    });

    test('unknown + whenOffline=queue → queue', async () => {
      const { client } = createTestClient();
      client.registerAction('t', {
        request: vi.fn(),
        options: { whenOffline: 'queue' },
      });
      const r = await client.execute('t', {});
      expect(r.enqueued).toBe(true);
    });

    test('retry on already canceled job → ignored', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      client.registerAction('t', {
        request: vi.fn(),
        options: { whenOffline: 'queue' },
      });
      const r = await client.execute('t', {});
      if (!r.enqueued) {
        return;
      }
      client.cancel(r.jobId);
      await client.retry(r.jobId);
      expect(client.getQueue().find((j) => j.id === r.jobId)?.status).toBe(
        'canceled',
      );
    });
  });

  describe('flushOption per-action override', () => {
    test('per-action concurrency overrides default', async () => {
      const callOrder: number[] = [];
      const requestFn = vi.fn().mockImplementation(
        (input: { n: number }) =>
          new Promise<void>((resolve) => {
            callOrder.push(input.n);
            setTimeout(resolve, 50);
          }),
      );
      const mock = createMockDetector();
      const client = getConnectivityClient({
        detectors: [mock.detector],
        defaultOptions: { actions: { flushOption: { concurrency: 1 } } },
      });
      client.start();
      mock.emit({ status: 'offline', reason: 'test' });

      client.registerAction('wide', {
        request: requestFn,
        options: { whenOffline: 'queue', flushOption: { concurrency: 10 } },
      });

      await client.execute('wide', { n: 1 });
      await client.execute('wide', { n: 2 });
      await client.execute('wide', { n: 3 });

      // online transition → flush
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(10);

      // per-action concurrency=10 so 3 start concurrently
      expect(callOrder).toEqual([1, 2, 3]);
    });
  });

  describe('dedupeOnFlush', () => {
    test('keep-last: only last runs among failed job and new queued job', async () => {
      let callCount = 0;
      const requestFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 1) {
          return Promise.reject(new Error('fail'));
        }
        return Promise.resolve('ok');
      });
      const mock = createMockDetector();
      const client = getConnectivityClient({
        detectors: [mock.detector],
      });
      client.start();
      mock.emit({ status: 'online', reason: 'test' });

      client.registerAction('save', {
        request: requestFn,
        options: {
          whenOffline: 'queue',
          retry: { maxAttempts: 1, backoffMs: () => 50 },
          dedupeKey: () => 'doc-1',
          dedupeOnFlush: 'keep-last',
        },
      });

      // first execution failed → job status: failed
      await client.execute('save', { v: 1 }).catch(() => {});

      // offline transition → new request queued
      mock.emit({ status: 'offline', reason: 'test' });
      await client.execute('save', { v: 2 });

      // queue: failed(v:1) + queued(v:2) same dedupeKey
      const queue = client.getQueue();
      const saveJobs = queue.filter((j) => j.actionKey === 'save');
      expect(saveJobs.length).toBe(2);

      // online → flush → dedupeOnFlush applied
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(200);

      // v:2 should be executed
      const lastCall = requestFn.mock.calls[requestFn.mock.calls.length - 1];
      expect(lastCall?.[0]).toEqual({ v: 2 });
    });

    test('enqueue-time dedupe: same dedupeKey queued job only replaces input', async () => {
      const requestFn = vi.fn().mockResolvedValue('ok');
      const mock = createMockDetector();
      const client = getConnectivityClient({
        detectors: [mock.detector],
      });
      client.start();
      mock.emit({ status: 'offline', reason: 'test' });

      client.registerAction('save', {
        request: requestFn,
        options: {
          whenOffline: 'queue',
          dedupeKey: () => 'same-key',
        },
      });

      await client.execute('save', { v: 1 });
      await client.execute('save', { v: 2 });
      await client.execute('save', { v: 3 });

      // enqueue-time dedupe leaves only 1, input is latest value
      const queue = client.getQueue();
      expect(queue.filter((j) => j.actionKey === 'save')).toHaveLength(1);
      expect(queue[0]?.input).toEqual({ v: 3 });

      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(100);

      expect(requestFn).toHaveBeenCalledTimes(1);
      expect(requestFn).toHaveBeenCalledWith({ v: 3 });
    });
  });

  describe('destroy race condition', () => {
    test('destroy during flush → stops without error', async () => {
      const requestFn = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 1000)),
        );
      const mock = createMockDetector();
      const client = getConnectivityClient({
        detectors: [mock.detector],
      });
      client.start();
      mock.emit({ status: 'offline', reason: 'test' });

      client.registerAction('slow', {
        request: requestFn,
        options: { whenOffline: 'queue' },
      });

      await client.execute('slow', {});
      await client.execute('slow', {});

      // flush starts with online transition
      mock.emit({ status: 'online', reason: 'test' });

      // destroy while flush is in progress
      client.destroy();

      // no error should occur even when advancing timers
      await vi.advanceTimersByTimeAsync(5000);

      // additional requests after destroy should not be processed
      expect(requestFn.mock.calls.length).toBeLessThanOrEqual(2);
    });
  });

  describe('onJobError', () => {
    test('latest attempt is passed', async () => {
      const onJobError = vi.fn();
      const mock = createMockDetector();
      const client = getConnectivityClient({
        detectors: [mock.detector],
        onJobError,
      });
      client.start();
      mock.emit({ status: 'online', reason: 'test' });

      client.registerAction('fail', {
        request: vi.fn().mockRejectedValue(new Error('fail')),
        options: {
          whenOffline: 'queue',
          retry: { maxAttempts: 2, backoffMs: () => 100 },
        },
      });

      await client.execute('fail', {}).catch(() => {});
      await vi.advanceTimersByTimeAsync(200);

      expect(onJobError).toHaveBeenCalledTimes(1);
      const call = onJobError.mock.calls[0];
      expect(call?.[1].attempt).toBe(2);
    });
  });

  describe('flush callbacks', () => {
    test('onFlushSuccess and onFlushSettled are called when flush succeeds', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });

      const onFlushSuccess = vi.fn();
      const onFlushSettled = vi.fn();

      client.registerAction('save', {
        request: vi.fn().mockResolvedValue({ saved: true }),
        options: { whenOffline: 'queue' },
        onFlushSuccess,
        onFlushSettled,
      });

      await client.execute('save', {});
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);

      expect(onFlushSuccess).toHaveBeenCalledWith({ saved: true });
      expect(onFlushSettled).toHaveBeenCalledOnce();
    });

    test('onFlushError and onFlushSettled are called when flush finally fails', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });

      const onFlushError = vi.fn();
      const onFlushSettled = vi.fn();

      client.registerAction('save', {
        request: vi.fn().mockRejectedValue(new Error('server error')),
        options: { whenOffline: 'queue' },
        onFlushError,
        onFlushSettled,
      });

      await client.execute('save', {});
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);

      expect(onFlushError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'server error' }),
      );
      expect(onFlushSettled).toHaveBeenCalledOnce();
    });

    test('flush callbacks are not called on intermediate retry attempts', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });

      const onFlushSuccess = vi.fn();
      const onFlushError = vi.fn();
      const onFlushSettled = vi.fn();
      let callCount = 0;

      client.registerAction('save', {
        request: () => {
          callCount++;
          if (callCount < 3) {
            return Promise.reject(new Error('retry'));
          }
          return Promise.resolve('ok');
        },
        options: {
          whenOffline: 'queue',
          retry: { maxAttempts: 3, backoffMs: () => 100 },
        },
        onFlushSuccess,
        onFlushError,
        onFlushSettled,
      });

      await client.execute('save', {});
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);

      expect(onFlushSuccess).not.toHaveBeenCalled();
      expect(onFlushError).not.toHaveBeenCalled();
      expect(onFlushSettled).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(300);

      expect(onFlushSuccess).toHaveBeenCalledOnce();
      expect(onFlushError).not.toHaveBeenCalled();
      expect(onFlushSettled).toHaveBeenCalledOnce();
    });
  });

  describe('execute with config overload', () => {
    test('online → immediate result (same behavior as string key)', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });

      const saveAction = actionOptions({
        actionKey: 'save-cfg',
        request: async (input: { id: string; data: string }) => ({
          saved: true,
          id: input.id,
        }),
      });

      const r = await client.execute(saveAction, {
        id: '1',
        data: 'hello',
      });
      expect(r.enqueued).toBe(false);
      if (!r.enqueued) {
        expect(r.result).toEqual({ saved: true, id: '1' });
      }
    });

    test('auto-registers when action is not registered', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });

      const action = actionOptions({
        actionKey: 'auto-reg',
        request: async () => 'ok',
      });

      // No registerAction call — should not throw "not registered"
      const r = await client.execute(action, undefined);
      expect(r.enqueued).toBe(false);
      if (!r.enqueued) {
        expect(r.result).toBe('ok');
      }
    });

    test('offline → enqueued', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });

      const action = actionOptions({
        actionKey: 'save-cfg-off',
        request: async (_input: { id: string }) => ({ saved: true }),
        whenOffline: 'queue',
      });

      const r = await client.execute(action, { id: '1' });
      expect(r.enqueued).toBe(true);
    });

    test('dedupeKey works with config overload', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });

      const action = actionOptions({
        actionKey: 'save-dedup',
        request: async (_input: { id: string; data: string }) => ({
          saved: true,
        }),
        whenOffline: 'queue',
        dedupeKey: (input) => input.id,
      });

      const r1 = await client.execute(action, { id: 'a', data: 'v1' });
      const r2 = await client.execute(action, { id: 'a', data: 'v2' });
      if (r1.enqueued && r2.enqueued) {
        expect(r1.jobId).toBe(r2.jobId);
      }
      const job = client.getQueue()[0];
      assert(job !== undefined);
      expect(job.input).toEqual({ id: 'a', data: 'v2' });
    });

    test('preserves existing registration with flush callbacks', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });

      const onFlushSuccess = vi.fn();

      // Register manually with flush callbacks first
      client.registerAction('save-preserve', {
        request: vi.fn().mockResolvedValue({ saved: true }),
        options: { whenOffline: 'queue' },
        onFlushSuccess,
      });

      // Config overload with same actionKey — should NOT overwrite registration
      const action = actionOptions({
        actionKey: 'save-preserve',
        request: async () => ({ saved: true }),
        whenOffline: 'queue',
      });

      await client.execute(action, {});

      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);

      // Flush callback from registerAction should still be called
      expect(onFlushSuccess).toHaveBeenCalledWith({ saved: true });
    });

    test('whenOffline: fail with config overload', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });

      const action = actionOptions({
        actionKey: 'fail-cfg',
        request: async () => 'ok',
        whenOffline: 'fail',
      });

      await expect(client.execute(action, undefined)).rejects.toThrow(
        "whenOffline='fail'",
      );
    });

    test('offline → flush invokes config.request, not a stale Map wrapper', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });

      const request = vi.fn().mockResolvedValue({ saved: true });
      const action = actionOptions({
        actionKey: 'flush-sync',
        request,
        whenOffline: 'queue',
      });

      await client.execute(action, { id: '1' });
      expect(request).not.toHaveBeenCalled();

      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);

      expect(request).toHaveBeenCalledOnce();
      expect(request).toHaveBeenCalledWith({ id: '1' });
    });

    test('config overload syncs Map even when action was previously registered', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });

      const staleRequest = vi.fn().mockResolvedValue('stale');
      client.registerAction('sync-override', {
        request: staleRequest,
        options: {},
      });

      const freshRequest = vi.fn().mockResolvedValue('fresh');
      const action = actionOptions({
        actionKey: 'sync-override',
        request: freshRequest,
      });

      const r = await client.execute(action, {});

      expect(staleRequest).not.toHaveBeenCalled();
      expect(freshRequest).toHaveBeenCalledOnce();
      if (!r.enqueued) {
        expect(r.result).toBe('fresh');
      }
    });
  });

  describe('setOnJobError', () => {
    test('setOnJobError updates the error handler dynamically', async () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      const { client, mock } = createTestClient({ onJobError: firstHandler });
      mock.emit({ status: 'offline', reason: 'test' });

      client.registerAction('fail-action', {
        request: vi.fn().mockRejectedValue(new Error('boom')),
        options: { whenOffline: 'queue' },
      });

      await client.execute('fail-action', {});

      client.setOnJobError(secondHandler);

      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);

      expect(firstHandler).not.toHaveBeenCalled();
      expect(secondHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'boom' }),
        expect.objectContaining({ actionKey: 'fail-action' }),
      );
    });

    test('setOnJobError with undefined disables the handler', async () => {
      const handler = vi.fn();
      const { client, mock } = createTestClient({ onJobError: handler });
      mock.emit({ status: 'offline', reason: 'test' });

      client.registerAction('fail-action', {
        request: vi.fn().mockRejectedValue(new Error('boom')),
        options: { whenOffline: 'queue' },
      });

      await client.execute('fail-action', {});

      client.setOnJobError(undefined);

      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('retry + flush race condition', () => {
    test('concurrent retry and flush do not double-execute the same job', async () => {
      const { client, mock } = createTestClient();
      const request = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve('ok'), 100)),
        );
      client.registerAction('dup', {
        request,
        options: { whenOffline: 'queue' },
      });

      mock.emit({ status: 'offline', reason: 'test' });
      await client.execute('dup', {});

      mock.emit({ status: 'online', reason: 'test' });

      const job = client.getQueue()[0];
      assert(job !== undefined);

      await Promise.all([client.retry(job.id), client.flush()]);
      await vi.advanceTimersByTimeAsync(200);

      expect(request).toHaveBeenCalledOnce();
    });

    test('retry is no-op when job is already running', async () => {
      const { client, mock } = createTestClient();
      let resolveRequest!: (v: string) => void;
      const request = vi.fn().mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            resolveRequest = resolve;
          }),
      );
      client.registerAction('slow', {
        request,
        options: { whenOffline: 'queue' },
      });

      mock.emit({ status: 'offline', reason: 'test' });
      await client.execute('slow', {});

      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);

      const job = client.getQueue()[0];
      assert(job !== undefined);
      expect(job.status).toBe('running');

      await client.retry(job.id);
      expect(request).toHaveBeenCalledOnce();

      resolveRequest('done');
      await vi.advanceTimersByTimeAsync(0);
    });
  });
});
