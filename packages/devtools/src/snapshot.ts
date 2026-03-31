import type { ConnectivityState, QueuedJob } from '@connectivity-js/core';

const INPUT_TRUNCATE_LENGTH = 80;

/**
 * Job info for display (input serialization, since → relative time, etc.)
 */
export interface DevToolsJobDisplay {
  id: string;
  actionKey: string;
  dedupeKey?: string;
  inputDisplay: string;
  createdAt: number;
  sinceDisplay: string;
  attempt: number;
  nextRunAt?: number;
  status: QueuedJob['status'];
  lastError?: string;
}

/**
 * Snapshot used by the DevTools UI
 */
export interface DevToolsSnapshot {
  state: ConnectivityState;
  stateSinceDisplay: string;
  queue: QueuedJob[];
  queueDisplay: DevToolsJobDisplay[];
}

function formatRelativeTime(ms: number) {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms < 3600_000) {
    return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  }
  return `${Math.floor(ms / 3600_000)}h ${Math.floor(
    (ms % 3600_000) / 60_000,
  )}m`;
}

function serializeInput(input: unknown): string {
  if (input === undefined) {
    return '—';
  }
  try {
    const str = JSON.stringify(input);
    if (str === undefined) {
      return '—';
    }
    if (str.length <= INPUT_TRUNCATE_LENGTH) {
      return str;
    }
    return `${str.slice(0, INPUT_TRUNCATE_LENGTH)}...`;
  } catch {
    return String(input);
  }
}

function errorToString(err: unknown) {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export function createDevToolsSnapshot(
  state: ConnectivityState,
  queue: QueuedJob[],
): DevToolsSnapshot {
  const now = Date.now();
  const stateSinceDisplay = formatRelativeTime(now - state.since);

  const queueDisplay: DevToolsJobDisplay[] = queue.map((job) => ({
    id: job.id,
    actionKey: job.actionKey,
    dedupeKey: job.dedupeKey,
    inputDisplay: serializeInput(job.input),
    createdAt: job.createdAt,
    sinceDisplay: formatRelativeTime(now - job.createdAt),
    attempt: job.attempt,
    nextRunAt: job.nextRunAt,
    status: job.status,
    lastError:
      job.lastError !== undefined ? errorToString(job.lastError) : undefined,
  }));

  return {
    state,
    stateSinceDisplay,
    queue,
    queueDisplay,
  };
}
