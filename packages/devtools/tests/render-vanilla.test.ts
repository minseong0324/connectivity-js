// @vitest-environment jsdom
import type {
  ConnectivityClient,
  ConnectivityState,
  QueuedJob,
} from '@connectivity-js/core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderConnectivityDevTools } from '../src/render-vanilla';

const BASE_TIME = 1_700_000_000_000;

type BridgeClient = Pick<
  ConnectivityClient,
  | 'getState'
  | 'getQueue'
  | 'subscribe'
  | 'subscribeQueue'
  | 'retry'
  | 'cancel'
  | 'flush'
>;

function makeState(
  status: ConnectivityState['status'] = 'online',
): ConnectivityState {
  return { status, since: BASE_TIME, quality: {} };
}

function makeJob(overrides: Partial<QueuedJob> = {}): QueuedJob {
  return {
    id: 'job_1',
    actionKey: 'save',
    input: { id: '1' },
    createdAt: BASE_TIME,
    attempt: 1,
    status: 'queued',
    ...overrides,
  };
}

function makeClient(
  overrides: { state?: ConnectivityState; queue?: QueuedJob[] } = {},
) {
  let stateSubscriber: (() => void) | null = null;
  let queueSubscriber: (() => void) | null = null;
  const unsubState = vi.fn(() => {
    stateSubscriber = null;
  });
  const unsubQueue = vi.fn(() => {
    queueSubscriber = null;
  });

  let currentState = overrides.state ?? makeState();
  let currentQueue = overrides.queue ?? [];

  const client: BridgeClient & {
    _triggerState: (s: ConnectivityState) => void;
    _triggerQueue: (q: QueuedJob[]) => void;
  } = {
    getState: vi.fn(() => currentState),
    getQueue: vi.fn(() => currentQueue),
    subscribe: vi.fn((_listener) => {
      stateSubscriber = () => _listener(currentState);
      return unsubState;
    }),
    subscribeQueue: vi.fn((_listener) => {
      queueSubscriber = _listener;
      return unsubQueue;
    }),
    retry: vi.fn((_jobId: string) => Promise.resolve()),
    cancel: vi.fn((_jobId: string) => {}),
    flush: vi.fn((_options?: { onlyActionKey?: string }) => Promise.resolve()),
    _triggerState(newState: ConnectivityState) {
      currentState = newState;
      stateSubscriber?.();
    },
    _triggerQueue(newQueue: QueuedJob[]) {
      currentQueue = newQueue;
      queueSubscriber?.();
    },
  };

  return client;
}

describe('renderConnectivityDevTools', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    container.remove();
  });

  describe('escapeHtml (tested indirectly via rendered output)', () => {
    test('XSS characters in actionKey are escaped in rendered HTML', () => {
      const xssString = '<script>alert("xss")</script>&"\'';
      const client = makeClient({
        queue: [makeJob({ actionKey: xssString })],
      });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;
      const html = panel.innerHTML;

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&amp;');

      cleanup();
    });

    test('XSS characters in inputDisplay are escaped', () => {
      const client = makeClient({
        queue: [makeJob({ input: '<img onerror=alert(1)>' })],
      });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;

      expect(panel.innerHTML).not.toContain('<img onerror');

      cleanup();
    });

    test('XSS characters in lastError are escaped', () => {
      const client = makeClient({
        queue: [
          makeJob({
            status: 'failed',
            lastError: new Error('<b>bold</b>'),
          }),
        ],
      });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;

      expect(panel.innerHTML).not.toContain('<b>bold</b>');
      expect(panel.innerHTML).toContain('&lt;b&gt;bold&lt;/b&gt;');

      cleanup();
    });
  });

  describe('statusColor (tested indirectly via rendered dot color)', () => {
    test('online status renders green dot (#22c55e)', () => {
      const client = makeClient({ state: makeState('online') });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;
      const dot = panel.querySelector('span') as HTMLSpanElement;

      expect(dot.style.color).toBe('rgb(34, 197, 94)');
      expect(dot.textContent).toBe('● ');

      cleanup();
    });

    test('offline status renders red dot (#ef4444)', () => {
      const client = makeClient({ state: makeState('offline') });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;
      const dot = panel.querySelector('span') as HTMLSpanElement;

      expect(dot.style.color).toBe('rgb(239, 68, 68)');

      cleanup();
    });

    test('unknown status renders gray dot (#a3a3a3)', () => {
      const client = makeClient({ state: makeState('unknown') });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;
      const dot = panel.querySelector('span') as HTMLSpanElement;

      expect(dot.style.color).toBe('rgb(163, 163, 163)');

      cleanup();
    });
  });

  describe('panel mount and cleanup', () => {
    test('mounts panel with data-connectivity-devtools attribute to container', () => {
      const client = makeClient();

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector('[data-connectivity-devtools]');
      expect(panel).not.toBeNull();

      cleanup();
    });

    test('cleanup function removes panel from container', () => {
      const client = makeClient();

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      expect(
        container.querySelector('[data-connectivity-devtools]'),
      ).not.toBeNull();

      cleanup();

      expect(
        container.querySelector('[data-connectivity-devtools]'),
      ).toBeNull();
    });
  });

  describe('toggle collapse', () => {
    test('clicking header toggles body visibility', () => {
      const client = makeClient();

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
        { initialOpen: true },
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;
      const header = panel.children[0] as HTMLElement;
      const body = panel.children[1] as HTMLElement;

      expect(body.style.display).toBe('block');

      header.click();
      expect(body.style.display).toBe('none');
      expect(header.textContent).toBe('Connectivity DevTools (collapsed)');

      header.click();
      expect(body.style.display).toBe('block');
      expect(header.textContent).toBe('Connectivity DevTools');

      cleanup();
    });
  });

  describe('position option', () => {
    test('defaults to bottom-right positioning', () => {
      const client = makeClient();

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;

      expect(panel.style.right).toBe('16px');
      expect(panel.style.left).toBe('auto');

      cleanup();
    });

    test('bottom-left positions panel on the left', () => {
      const client = makeClient();

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
        { position: 'bottom-left' },
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;

      expect(panel.style.left).toBe('16px');
      expect(panel.style.right).toBe('auto');

      cleanup();
    });
  });

  describe('initialOpen option', () => {
    test('body is visible when initialOpen is true (default)', () => {
      const client = makeClient();

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;
      const body = panel.children[1] as HTMLElement;

      expect(body.style.display).toBe('block');

      cleanup();
    });

    test('body is hidden when initialOpen is false', () => {
      const client = makeClient();

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
        { initialOpen: false },
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;
      const body = panel.children[1] as HTMLElement;

      expect(body.style.display).toBe('none');

      cleanup();
    });
  });

  describe('status display', () => {
    test('displays status text with relative time', () => {
      const client = makeClient({ state: makeState('online') });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;

      expect(panel.textContent).toContain('Status: online');

      cleanup();
    });

    test('displays quality info when available', () => {
      const state: ConnectivityState = {
        status: 'online',
        since: BASE_TIME,
        quality: { rttMs: 50, effectiveType: '4g', downlink: 10 },
      };
      const client = makeClient({ state });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;

      expect(panel.textContent).toContain('rtt 50ms');
      expect(panel.textContent).toContain('4g');
      expect(panel.textContent).toContain('10 Mbps');

      cleanup();
    });
  });

  describe('queue display', () => {
    test('shows "Queue is empty" when no jobs', () => {
      const client = makeClient({ queue: [] });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;

      expect(panel.textContent).toContain('Queue is empty');

      cleanup();
    });

    test('displays queue count and job details', () => {
      const client = makeClient({
        queue: [
          makeJob({ id: 'job_1', actionKey: 'save', status: 'queued' }),
          makeJob({ id: 'job_2', actionKey: 'delete', status: 'failed' }),
        ],
      });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;

      expect(panel.textContent).toContain('Queue (2)');
      expect(panel.textContent).toContain('save');
      expect(panel.textContent).toContain('delete');

      cleanup();
    });

    test('updates when queue changes', () => {
      const client = makeClient({ queue: [] });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;

      expect(panel.textContent).toContain('Queue (0)');
      expect(panel.textContent).toContain('Queue is empty');

      client._triggerQueue([makeJob({ id: 'job_1', actionKey: 'upload' })]);

      expect(panel.textContent).toContain('Queue (1)');
      expect(panel.textContent).toContain('upload');

      cleanup();
    });
  });

  describe('button interactions', () => {
    test('Flush All button calls bridge.flush()', () => {
      const client = makeClient({
        queue: [makeJob()],
      });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;
      const flushBtn = Array.from(panel.querySelectorAll('button')).find(
        (btn) => btn.textContent === 'Flush All',
      );

      expect(flushBtn).not.toBeUndefined();
      flushBtn!.click();

      expect(client.flush).toHaveBeenCalled();

      cleanup();
    });

    test('Retry button calls client.retry() with job id for queued jobs', () => {
      const client = makeClient({
        queue: [makeJob({ id: 'job_42', status: 'queued' })],
      });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;
      const retryBtn = Array.from(panel.querySelectorAll('button')).find(
        (btn) => btn.textContent === 'Retry',
      );

      expect(retryBtn).not.toBeUndefined();
      retryBtn!.click();

      expect(client.retry).toHaveBeenCalledWith('job_42');

      cleanup();
    });

    test('Retry button appears for failed jobs', () => {
      const client = makeClient({
        queue: [makeJob({ id: 'job_fail', status: 'failed' })],
      });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;
      const retryBtn = Array.from(panel.querySelectorAll('button')).find(
        (btn) => btn.textContent === 'Retry',
      );

      expect(retryBtn).not.toBeUndefined();

      cleanup();
    });

    test('Retry button does not appear for in-progress jobs', () => {
      const client = makeClient({
        queue: [makeJob({ id: 'job_run', status: 'running' })],
      });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;
      const retryBtn = Array.from(panel.querySelectorAll('button')).find(
        (btn) => btn.textContent === 'Retry',
      );

      expect(retryBtn).toBeUndefined();

      cleanup();
    });

    test('Cancel button calls client.cancel() with job id', () => {
      const client = makeClient({
        queue: [makeJob({ id: 'job_99', status: 'queued' })],
      });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;
      const cancelBtn = Array.from(panel.querySelectorAll('button')).find(
        (btn) => btn.textContent === 'Cancel',
      );

      expect(cancelBtn).not.toBeUndefined();
      cancelBtn!.click();

      expect(client.cancel).toHaveBeenCalledWith('job_99');

      cleanup();
    });

    test('Cancel button is present for all job statuses', () => {
      const client = makeClient({
        queue: [makeJob({ id: 'job_run', status: 'running' })],
      });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;
      const cancelBtn = Array.from(panel.querySelectorAll('button')).find(
        (btn) => btn.textContent === 'Cancel',
      );

      expect(cancelBtn).not.toBeUndefined();

      cleanup();
    });
  });

  describe('state updates re-render', () => {
    test('status dot color updates when state changes', () => {
      const client = makeClient({ state: makeState('online') });

      const cleanup = renderConnectivityDevTools(
        container,
        client as ConnectivityClient,
      );

      const panel = container.querySelector(
        '[data-connectivity-devtools]',
      ) as HTMLElement;

      const getDotColor = () => {
        const body = panel.children[1] as HTMLElement;
        const dot = body.querySelector('span') as HTMLSpanElement;
        return dot.style.color;
      };

      expect(getDotColor()).toBe('rgb(34, 197, 94)');

      client._triggerState(makeState('offline'));
      expect(getDotColor()).toBe('rgb(239, 68, 68)');

      cleanup();
    });
  });
});
