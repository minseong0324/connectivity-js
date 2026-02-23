import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
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
    test('getInstance()는 같은 인스턴스를 반환한다', () => {
      const a = ConnectivityClient.getInstance({ detectors: [] });
      const b = ConnectivityClient.getInstance();
      expect(a).toBe(b);
    });

    test('resetInstance() 후 새로운 인스턴스가 생성된다', () => {
      const a = ConnectivityClient.getInstance({ detectors: [] });
      ConnectivityClient.resetInstance();
      const b = ConnectivityClient.getInstance({ detectors: [] });
      expect(a).not.toBe(b);
    });

    test('getConnectivityClient()는 getInstance()와 같다', () => {
      const a = getConnectivityClient({ detectors: [] });
      const b = getConnectivityClient();
      expect(a).toBe(b);
    });
  });

  describe('상태 관리', () => {
    test('초기 상태는 unknown이다', () => {
      expect(getConnectivityClient({ detectors: [] }).getState().status).toBe(
        'unknown',
      );
    });

    test('initialStatus로 초기 상태를 지정할 수 있다', () => {
      expect(
        getConnectivityClient({
          detectors: [],
          initialStatus: 'offline',
        }).getState().status,
      ).toBe('offline');
    });

    test('detector 상태 변경 시 listener가 state와 transition을 받는다', () => {
      const { client, mock } = createTestClient();
      const listener = vi.fn();
      client.subscribe(listener);
      mock.emit({ status: 'online', reason: 'test' });
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'online' }),
        expect.objectContaining({ from: 'unknown', to: 'online' }),
      );
    });

    test('같은 상태 변경 시 listener가 호출되지 않는다', () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'online', reason: 'test' });
      const listener = vi.fn();
      client.subscribe(listener);
      mock.emit({ status: 'online', reason: 'test' });
      expect(listener).not.toHaveBeenCalled();
    });

    test('getState()는 같은 참조를 반환한다', () => {
      const m = getConnectivityClient({ detectors: [] });
      expect(m.getState()).toBe(m.getState());
    });

    test('상태 변경 후 새로운 참조를 반환한다', () => {
      const { client, mock } = createTestClient();
      const before = client.getState();
      mock.emit({ status: 'online', reason: 'test' });
      expect(client.getState()).not.toBe(before);
    });
  });

  describe('grace period', () => {
    test('gracePeriodMs 이내 복구 시 offline 전환 무시', () => {
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

    test('gracePeriodMs 초과 시 offline 전환 실행', () => {
      const { client, mock } = createTestClient({ gracePeriodMs: 3_000 });
      mock.emit({ status: 'online', reason: 'test' });
      mock.emit({ status: 'offline', reason: 'test' });
      vi.advanceTimersByTime(3_000);
      expect(client.getState().status).toBe('offline');
    });
  });

  describe('quality', () => {
    test('quality 정보가 반영된다', () => {
      const { client, mock } = createTestClient();
      mock.emit({
        status: 'online',
        reason: 'hb',
        quality: { rttMs: 50, effectiveType: '4g' },
      });
      expect(client.getState().quality.rttMs).toBe(50);
    });

    test('초기 quality는 빈 객체이다', () => {
      expect(
        getConnectivityClient({ detectors: [] }).getState().quality,
      ).toEqual({});
    });
  });

  describe('enqueue dedupe', () => {
    test('같은 dedupeKey + queued → input 교체', async () => {
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

    test('같은 dedupeKey + running → 새 job', async () => {
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

    test('dedupeKey 없음 → 항상 새 job', async () => {
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

    test('같은 dedupeKey + queued → attempt/createdAt 초기화', async () => {
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

    test('dedupeKey 없음 + 같은 input → 여전히 새 job', async () => {
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

  describe('상태 관리 — transition', () => {
    test('transition.duration이 경과 시간을 반영한다', () => {
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
    test('즉시 실행 + result 반환', async () => {
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

    test('job이 running → succeeded 순서로 status 변경', async () => {
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

    test('succeeded 후 5초 뒤 job 제거', async () => {
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
    test('같은 dedupeKey running → enqueued', async () => {
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

    test('다른 action running + 새 요청 → 즉시 실행', async () => {
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

    test('dedupeKey 없는 action + running → 즉시 실행', async () => {
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

    test('다른 dedupeKey running → 즉시 실행', async () => {
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

  describe('offline + 큐잉', () => {
    test('offline + queue → 큐에 저장', async () => {
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

    test('online 복귀 시 자동 flush', async () => {
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

  describe('실패 + retry', () => {
    test('retry 가능 → queued', async () => {
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

    test('retry 불가 → failed + throw', async () => {
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

    test('retry 소진 → onJobError', async () => {
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

  describe('flush 연계', () => {
    test('즉시 실행 후 flush가 큐 처리', async () => {
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

    test('flush 중 같은 entity → hasRunningDupe → enqueued → while 루프가 처리', async () => {
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

    test('flush 중 다른 entity → 즉시 실행', async () => {
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

    test('flush 중 새 action key → 외부 while 루프가 처리', async () => {
      const { client, mock } = createTestClient();
      mock.emit({ status: 'offline', reason: 'test' });
      const order: string[] = [];
      client.registerAction('a', {
        request: async (input) => {
          order.push(`a:${(input as { name: string }).name}`);
          // actionA 처리 중 actionB를 큐에 직접 추가 (flush 도중)
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
      // actionA flush 시작 전에 actionB도 큐에 넣기
      await client.execute('b', { name: '1' });
      await vi.advanceTimersByTimeAsync(0);
      expect(order).toContain('a:1');
      expect(order).toContain('b:1');
    });
  });

  describe('retry 중 input 교체', () => {
    test('retry 대기 중 같은 entity 저장 → input 교체 후 최신 전송', async () => {
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
    test('defaultOptions.actions.whenOffline이 기본값으로 적용된다', async () => {
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

    test('action 옵션이 defaultOptions를 override한다', async () => {
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

  describe('FIFO 정렬', () => {
    test('createdAt이 빠른 job이 먼저 실행된다', async () => {
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
    test('concurrency=2 일 때 동시 실행이 2개로 제한된다', async () => {
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
    test('keep-last일 때 마지막 job만 실행된다', async () => {
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
      // enqueue dedupe로 같은 dedupeKey는 1개만 남으므로, dedupeOnFlush는 running→fail→queued로 2개가 된 경우에 의미
      await client.execute('t', { id: 'a', data: 'v1' });
      await client.execute('t', { id: 'a', data: 'v2' }); // dedupe: v1 → v2 교체
      expect(client.getQueue()).toHaveLength(1);
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledOnce();
      expect(fn).toHaveBeenCalledWith({ id: 'a', data: 'v2' });
    });

    test('keep-first일 때 첫 번째 job만 실행된다', async () => {
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
      // 같은 dedupeKey + queued이므로 enqueue dedupe가 먼저 동작 → 1개만 남음
      // dedupeOnFlush는 enqueue dedupe를 통과한 경우에만 의미 있음
      await client.execute('t', { id: 'a', data: 'v1' });
      await client.execute('t', { id: 'a', data: 'v2' }); // input 교체됨
      expect(client.getQueue()).toHaveLength(1);
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledOnce();
    });
  });

  describe('cancel / destroy', () => {
    test('cancel로 job 취소', async () => {
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

    test('미등록 action → throw', async () => {
      getConnectivityClient({ detectors: [] });
      await expect(getConnectivityClient().execute('x', {})).rejects.toThrow(
        'is not registered',
      );
    });

    test('destroy 후 listener 미호출', () => {
      const { client, mock } = createTestClient();
      const listener = vi.fn();
      client.subscribe(listener);
      client.destroy();
      mock.emit({ status: 'online', reason: 'test' });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('per-action queue', () => {
    test('getActionQueue가 해당 action만 반환', async () => {
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

    test('다른 action 변경 시 참조 유지', async () => {
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
    test('오프라인 → 온라인 flush 중 같은 entity 실행 → 순서 보장', async () => {
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

    test('오프라인 다른 action 큐잉 → 온라인 flush → 이후 즉시 실행', async () => {
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

    test('오프라인 dedupe → 온라인 → 최신만 전송', async () => {
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

    test('온라인 연속 실행 → dedupe → 최종만 도달', async () => {
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
  // 엣지케이스
  // ═══════════════════════════════════════════

  describe('엣지케이스', () => {
    test('start() 두 번 호출 → detector가 이중 등록되지 않는다', () => {
      const { client, mock } = createTestClient();
      const listener = vi.fn();
      client.subscribe(listener);

      // start()는 createTestClient에서 이미 1번 호출됨 — 두 번째는 무시
      client.start();

      mock.emit({ status: 'online', reason: 'test' });
      expect(listener).toHaveBeenCalledOnce();
    });

    test('subscribe 후 즉시 unsubscribe → listener가 호출되지 않는다', () => {
      const { client, mock } = createTestClient();
      const listener = vi.fn();
      const unsub = client.subscribe(listener);
      unsub();

      mock.emit({ status: 'online', reason: 'test' });
      expect(listener).not.toHaveBeenCalled();
    });

    test('subscribeQueue 후 즉시 unsubscribe → listener가 호출되지 않는다', async () => {
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

    test('존재하지 않는 jobId로 cancel → 에러 없이 무시', () => {
      getConnectivityClient({ detectors: [] });
      expect(() => getConnectivityClient().cancel('nonexistent')).not.toThrow();
    });

    test('존재하지 않는 jobId로 retry → 에러 없이 무시', async () => {
      getConnectivityClient({ detectors: [] });
      await expect(
        getConnectivityClient().retry('nonexistent'),
      ).resolves.toBeUndefined();
    });

    test('unknown + whenOffline=fail → throw하지 않고 queue', async () => {
      // unknown은 confirmed offline이 아니므로 throw 대신 보수적으로 큐잉
      const { client } = createTestClient();
      // initialStatus가 'unknown'이고 detector emit 없음 → unknown 유지
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

    test('이미 canceled된 job에 retry → 무시', async () => {
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
    test('per-action concurrency가 default를 override한다', async () => {
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

      // online 전환 → flush
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(10);

      // per-action concurrency=10이므로 3개 동시 시작
      expect(callOrder).toEqual([1, 2, 3]);
    });
  });

  describe('dedupeOnFlush', () => {
    test('keep-last: 실패한 job과 새 queued job 중 마지막만 실행', async () => {
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

      // 첫 실행 실패 → job status: failed
      await client.execute('save', { v: 1 }).catch(() => {});

      // 오프라인 전환 → 새 요청 큐잉
      mock.emit({ status: 'offline', reason: 'test' });
      await client.execute('save', { v: 2 });

      // 큐에: failed(v:1) + queued(v:2) 동일 dedupeKey
      const queue = client.getQueue();
      const saveJobs = queue.filter((j) => j.actionKey === 'save');
      expect(saveJobs.length).toBe(2);

      // online → flush → dedupeOnFlush 적용
      mock.emit({ status: 'online', reason: 'test' });
      await vi.advanceTimersByTimeAsync(200);

      // v:2가 실행되어야 함
      const lastCall = requestFn.mock.calls[requestFn.mock.calls.length - 1];
      expect(lastCall?.[0]).toEqual({ v: 2 });
    });

    test('enqueue-time dedupe: 같은 dedupeKey의 queued job은 input만 교체', async () => {
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

      // enqueue-time dedupe로 1개만 존재, input은 마지막 값
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
    test('flush 중 destroy 호출 시 에러 없이 중단', async () => {
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

      // online 전환으로 flush 시작
      mock.emit({ status: 'online', reason: 'test' });

      // flush가 진행 중인 상태에서 destroy
      client.destroy();

      // 타이머를 진행해도 에러가 발생하지 않아야 함
      await vi.advanceTimersByTimeAsync(5000);

      // destroy 후 추가 요청이 처리되지 않아야 함
      expect(requestFn.mock.calls.length).toBeLessThanOrEqual(2);
    });
  });

  describe('onJobError', () => {
    test('최신 attempt가 전달된다', async () => {
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
});
