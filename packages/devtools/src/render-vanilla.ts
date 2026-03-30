import type {
  ConnectivityClient,
  ConnectivityStatus,
} from '@connectivity-js/core';
import { createDevToolsBridge } from './bridge';

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

const PANEL_STYLES: Record<string, string> = {
  position: 'fixed',
  bottom: '16px',
  width: '360px',
  maxHeight: '400px',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  fontSize: '12px',
  backgroundColor: '#1e1e1e',
  color: '#e5e5e5',
  borderRadius: '8px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  zIndex: '2147483647',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const HEADER_STYLES: Record<string, string> = {
  padding: '8px 12px',
  backgroundColor: '#2d2d2d',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  cursor: 'pointer',
  userSelect: 'none',
};

const BODY_STYLES: Record<string, string> = {
  padding: '12px',
  overflowY: 'auto',
  flex: '1',
};

const STATUS_STYLES: Record<string, string> = {
  marginBottom: '12px',
};

const QUEUE_HEADER_STYLES: Record<string, string> = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '8px',
};

const JOB_ROW_STYLES: Record<string, string> = {
  padding: '6px 8px',
  marginBottom: '4px',
  backgroundColor: '#252525',
  borderRadius: '4px',
  fontSize: '11px',
};

const BUTTON_STYLES: Record<string, string> = {
  padding: '2px 6px',
  marginLeft: '4px',
  fontSize: '10px',
  cursor: 'pointer',
  border: '1px solid #555',
  borderRadius: '4px',
  backgroundColor: '#333',
  color: '#e5e5e5',
};

function applyStyles(el: HTMLElement, styles: Record<string, string>) {
  for (const [k, v] of Object.entries(styles)) {
    (el.style as unknown as Record<string, string>)[k] = v;
  }
}

function statusColor(status: ConnectivityStatus) {
  switch (status) {
    case 'online':
      return '#22c55e';
    case 'offline':
      return '#ef4444';
    case 'unknown':
      return '#a3a3a3';
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}

export interface RenderConnectivityDevToolsOptions {
  position?: 'bottom-left' | 'bottom-right';
  initialOpen?: boolean;
}

/**
 * Renders the Connectivity DevTools panel with vanilla DOM.
 * Works without React.
 *
 * @param container - DOM element to mount to
 * @param client - ConnectivityClient instance
 * @param options - position, initialOpen
 * @returns Cleanup function (call on unmount)
 */
export function renderConnectivityDevTools(
  container: HTMLElement,
  client: ConnectivityClient,
  options?: RenderConnectivityDevToolsOptions,
): () => void {
  const { position = 'bottom-right', initialOpen = true } = options ?? {};
  const bridge = createDevToolsBridge(client);

  const panel = document.createElement('div');
  panel.setAttribute('data-connectivity-devtools', 'true');
  applyStyles(panel, {
    ...PANEL_STYLES,
    ...(position === 'bottom-right'
      ? { right: '16px', left: 'auto' }
      : { left: '16px', right: 'auto' }),
  });

  const header = document.createElement('div');
  applyStyles(header, HEADER_STYLES);
  header.textContent = 'Connectivity DevTools';

  const body = document.createElement('div');
  applyStyles(body, BODY_STYLES);
  body.style.display = initialOpen ? 'block' : 'none';

  let isOpen = initialOpen;

  function toggle() {
    isOpen = !isOpen;
    body.style.display = isOpen ? 'block' : 'none';
    header.textContent = isOpen
      ? 'Connectivity DevTools'
      : 'Connectivity DevTools (collapsed)';
  }

  header.addEventListener('click', toggle);

  panel.appendChild(header);
  panel.appendChild(body);

  function render() {
    body.innerHTML = '';
    const snap = bridge.getSnapshot();

    const statusSection = document.createElement('div');
    applyStyles(statusSection, STATUS_STYLES);
    const statusDot = document.createElement('span');
    statusDot.style.color = statusColor(snap.state.status);
    statusDot.textContent = '● ';
    const statusText = document.createElement('span');
    statusText.textContent = `Status: ${snap.state.status} (${snap.stateSinceDisplay})`;
    statusSection.appendChild(statusDot);
    statusSection.appendChild(statusText);

    const hasQualityInfo =
      snap.state.quality.rttMs !== undefined ||
      snap.state.quality.effectiveType !== undefined ||
      snap.state.quality.downlink !== undefined;

    if (hasQualityInfo) {
      const qualityParts: string[] = [];
      if (snap.state.quality.rttMs !== undefined) {
        qualityParts.push(`rtt ${snap.state.quality.rttMs}ms`);
      }
      if (snap.state.quality.effectiveType) {
        qualityParts.push(snap.state.quality.effectiveType);
      }
      if (snap.state.quality.downlink !== undefined) {
        qualityParts.push(`${snap.state.quality.downlink} Mbps`);
      }
      const qualityEl = document.createElement('div');
      qualityEl.style.marginTop = '4px';
      qualityEl.style.fontSize = '11px';
      qualityEl.style.color = '#a3a3a3';
      qualityEl.textContent = `Quality: ${qualityParts.join(' · ')}`;
      statusSection.appendChild(qualityEl);
    }
    body.appendChild(statusSection);

    const queueHeader = document.createElement('div');
    applyStyles(queueHeader, QUEUE_HEADER_STYLES);
    queueHeader.innerHTML = `<strong>Queue (${snap.queue.length})</strong>`;
    const flushBtn = document.createElement('button');
    applyStyles(flushBtn, BUTTON_STYLES);
    flushBtn.textContent = 'Flush All';
    flushBtn.addEventListener('click', () => {
      void bridge.flush();
    });
    queueHeader.appendChild(flushBtn);
    body.appendChild(queueHeader);

    for (const job of snap.queueDisplay) {
      const row = document.createElement('div');
      applyStyles(row, JOB_ROW_STYLES);
      row.innerHTML = `
        <div style="margin-bottom:2px">
          <strong>${escapeHtml(job.actionKey)}</strong> ${escapeHtml(
            job.status,
          )}
          ${
            job.lastError
              ? `<span style="color:#ef4444">${escapeHtml(
                  job.lastError,
                )}</span>`
              : ''
          }
        </div>
        <div style="color:#a3a3a3;word-break:break-all">${escapeHtml(
          job.inputDisplay,
        )}</div>
      `;
      const btnContainer = document.createElement('div');
      btnContainer.style.marginTop = '4px';

      if (job.status === 'queued' || job.status === 'failed') {
        const retryBtn = document.createElement('button');
        applyStyles(retryBtn, BUTTON_STYLES);
        retryBtn.textContent = 'Retry';
        retryBtn.addEventListener('click', () => bridge.retry(job.id));
        btnContainer.appendChild(retryBtn);
      }
      const cancelBtn = document.createElement('button');
      applyStyles(cancelBtn, BUTTON_STYLES);
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => bridge.cancel(job.id));
      btnContainer.appendChild(cancelBtn);

      row.appendChild(btnContainer);
      body.appendChild(row);
    }

    if (snap.queue.length === 0) {
      const empty = document.createElement('div');
      empty.style.color = '#737373';
      empty.style.fontSize = '11px';
      empty.textContent = 'Queue is empty';
      body.appendChild(empty);
    }
  }

  bridge.subscribe(render);
  render();

  container.appendChild(panel);

  return () => {
    bridge.destroy();
    panel.remove();
  };
}
