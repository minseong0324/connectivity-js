'use client';

import { useAction, useConnectivity, useQueue } from '@connectivity-js/react';
import { ConnectivityDevTools } from '@connectivity-js/react-devtools';
import { useEffect, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';
import {
  type ManualDetector,
  useConnectivityClient,
  useDemoDetector,
} from '@/components/connectivity-demo-provider';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const ACTIONS = [
  { key: 'demo-save', label: 'Save Document', icon: '💾' },
  { key: 'demo-sync', label: 'Sync Data', icon: '🔄' },
] as const;

type ActionKey = (typeof ACTIONS)[number]['key'];

const T = {
  en: {
    online: 'Online',
    offline: 'Offline',
    goOffline: 'Go Offline',
    goOnline: 'Go Online',
    tryAction: 'Actions',
    offlineQueue: 'Offline Queue',
    queueEmpty: 'Queue is empty',
    execNow: '→ Executes immediately',
    execQueued: '→ Stored in queue',
    completed: 'completed',
    queued: 'queued',
    pending: 'pending',
    running: 'running...',
    showCode: 'Show code',
    showDemo: 'Show demo',
    tabStatus: 'Status',
    tabQueue: 'Queue',
    statusHint: 'Toggle network to see toast notifications',
    toastOffline: 'You are offline',
    toastOnline: 'Back online!',
  },
  ko: {
    online: 'Online',
    offline: 'Offline',
    goOffline: 'Go Offline',
    goOnline: 'Go Online',
    tryAction: 'Actions',
    offlineQueue: 'Offline Queue',
    queueEmpty: 'Queue is empty',
    execNow: '→ Executes immediately',
    execQueued: '→ Stored in queue',
    completed: 'completed',
    queued: 'queued',
    pending: 'pending',
    running: 'running...',
    showCode: 'Show code',
    showDemo: 'Show demo',
    tabStatus: 'Status',
    tabQueue: 'Queue',
    statusHint: 'Toggle network to see toast notifications',
    toastOffline: 'You are offline',
    toastOnline: 'Back online!',
  },
};

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Syntax tokenizer (One Dark palette)
// ---------------------------------------------------------------------------

type Token = { text: string; color: string };

const KEYWORDS = new Set([
  'import',
  'from',
  'export',
  'default',
  'function',
  'return',
  'const',
  'let',
  'var',
  'async',
  'await',
  'if',
  'else',
  'type',
  'interface',
  'class',
  'new',
  'this',
  'true',
  'false',
  'null',
  'undefined',
  'void',
  'of',
  'in',
]);

function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < code.length) {
    const ch = code[i] as string;
    // Line comments
    if (ch === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i);
      const text = end === -1 ? code.slice(i) : code.slice(i, end);
      tokens.push({ text, color: '#5c6370' });
      i += text.length;
      continue;
    }
    // Strings & template literals
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== ch) {
        if (code[j] === '\\') {
          j++;
        }
        j++;
      }
      tokens.push({ text: code.slice(i, j + 1), color: '#98c379' });
      i = j + 1;
      continue;
    }
    // Numbers
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < code.length && /[0-9_.]/.test(code[j] as string)) {
        j++;
      }
      tokens.push({ text: code.slice(i, j), color: '#d19a66' });
      i = j;
      continue;
    }
    // Identifiers / keywords
    if (/[a-zA-Z_$]/.test(ch)) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_$]/.test(code[j] as string)) {
        j++;
      }
      const word = code.slice(i, j);
      let color = '#abb2bf';
      if (KEYWORDS.has(word)) {
        color = '#c678dd';
      } else if (/^[A-Z]/.test(word)) {
        color = '#e06c75';
      } else if (code[j] === '(') {
        color = '#61afef';
      }
      tokens.push({ text: word, color });
      i = j;
      continue;
    }
    tokens.push({ text: ch, color: '#abb2bf' });
    i++;
  }
  return tokens;
}

function SyntaxCode({ code }: { code: string }) {
  return (
    <pre
      className="text-[11.5px] font-mono leading-relaxed p-5 h-full overflow-auto"
      style={{ background: '#0d1117', margin: 0 }}
    >
      {tokenize(code).map((tok, idx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: tokens are derived from a static code string and never reorder
        <span key={`${tok.text}-${idx}`} style={{ color: tok.color }}>
          {tok.text}
        </span>
      ))}
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Code snippets
// ---------------------------------------------------------------------------

const STATUS_CODE = `import { useConnectivity } from "@connectivity-js/react"
import { toast } from "sonner"

function NetworkStatus() {
  const { status } = useConnectivity()

  useEffect(() => {
    if (status === "offline") {
      toast.error("You are offline")
    } else if (status === "online") {
      toast.success("Back online!")
    }
  }, [status])

  return <div>Status: {status}</div>
}`;

const QUEUE_CODE = `import {
  ConnectivityProvider,
  useAction,
} from "@connectivity-js/react"

function SaveButton() {
  const { execute, pendingCount } = useAction(
    {
      actionKey: "save",
      request: (data) => api.save(data),
    },
    {
      onSuccess: () => toast.success("Saved!"),
      onEnqueued: () => toast.info("Queued — will sync"),
    }
  )

  return (
    <button onClick={() => execute(data)}>
      Save {pendingCount > 0 &&
        \`(\${pendingCount} pending)\`}
    </button>
  )
}`;

// ---------------------------------------------------------------------------
// Status tab
// ---------------------------------------------------------------------------

function StatusDemo({
  lang,
  detector,
}: {
  lang: 'en' | 'ko';
  detector: ManualDetector;
}) {
  const t = T[lang];
  const { status } = useConnectivity();
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = status;
    if (prev === null) {
      return;
    }
    if (status === 'offline') {
      toast.error(t.toastOffline);
    } else if (status === 'online') {
      toast.success(t.toastOnline);
    }
  }, [status, t.toastOffline, t.toastOnline]);

  return (
    <div className="p-5 flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-3 h-3 rounded-full flex-shrink-0 transition-colors ${
              status === 'online'
                ? 'bg-emerald-500'
                : 'bg-red-500 animate-pulse'
            }`}
          />
          <span
            className={`text-sm font-bold font-mono ${
              status === 'online'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {status === 'online' ? t.online : t.offline}
          </span>
        </div>
        <button
          type="button"
          onClick={() =>
            status === 'online' ? detector.setOffline() : detector.setOnline()
          }
          className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
            status === 'online'
              ? 'bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-600 dark:text-gray-300'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm'
          }`}
        >
          {status === 'online' ? t.goOffline : t.goOnline}
        </button>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 font-mono border-t border-gray-100 dark:border-neutral-800 pt-4">
        {t.statusHint}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue tab
// ---------------------------------------------------------------------------

function QueueDemo({
  lang,
  detector,
}: {
  lang: 'en' | 'ko';
  detector: ManualDetector;
}) {
  const t = T[lang];
  const { status } = useConnectivity();
  const { jobs } = useQueue();

  const lbl = (key: ActionKey) => {
    const a = ACTIONS.find((x) => x.key === key);
    return a?.label ?? key;
  };

  const saveAction = useAction(
    {
      actionKey: 'demo-save',
      request: async () => {
        await delay(700);
        return 'ok';
      },
    },
    {
      onSuccess: () => toast.success(`💾 ${lbl('demo-save')} ${t.completed}`),
      onEnqueued: () => toast.info(`💾 ${lbl('demo-save')} ${t.queued}`),
    },
  );

  const syncAction = useAction(
    {
      actionKey: 'demo-sync',
      request: async () => {
        await delay(700);
        return 'ok';
      },
    },
    {
      onSuccess: () => toast.success(`🔄 ${lbl('demo-sync')} ${t.completed}`),
      onEnqueued: () => toast.info(`🔄 ${lbl('demo-sync')} ${t.queued}`),
    },
  );

  const handlers: Record<ActionKey, () => void> = {
    'demo-save': () => saveAction.execute(undefined),
    'demo-sync': () => syncAction.execute(undefined),
  };

  const activeJobs = jobs.filter(
    (j) => j.status === 'queued' || j.status === 'running',
  );
  const pendingCount = jobs.filter((j) => j.status === 'queued').length;

  return (
    <div className="h-full flex flex-col">
      {/* Status bar */}
      <div
        className={`px-4 py-2 flex items-center justify-between border-b transition-colors flex-shrink-0 ${
          status === 'online'
            ? 'border-gray-100 dark:border-neutral-800'
            : 'border-red-100 dark:border-red-900/30 bg-red-50/60 dark:bg-red-950/20'
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              status === 'online'
                ? 'bg-emerald-500'
                : 'bg-red-500 animate-pulse'
            }`}
          />
          <span
            className={`text-xs font-semibold font-mono ${
              status === 'online'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {status === 'online' ? t.online : t.offline}
          </span>
        </div>
        <button
          type="button"
          onClick={() =>
            status === 'online' ? detector.setOffline() : detector.setOnline()
          }
          className={`text-xs px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
            status === 'online'
              ? 'bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-600 dark:text-gray-300'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm'
          }`}
        >
          {status === 'online' ? t.goOffline : t.goOnline}
        </button>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-neutral-800 flex-1 min-h-0">
        {/* Actions */}
        <div className="p-3 flex flex-col">
          <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            {t.tryAction}
          </div>
          <div className="flex flex-col gap-1.5">
            {ACTIONS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => handlers[a.key]()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-left transition-all text-gray-700 dark:text-gray-300 cursor-pointer group"
              >
                <span className="text-sm">{a.icon}</span>
                <span className="text-xs font-medium flex-1">{a.label}</span>
                <span
                  className={`text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity ${
                    status === 'online' ? 'text-emerald-500' : 'text-amber-500'
                  }`}
                >
                  {status === 'online' ? 'run' : 'queue'}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-auto pt-2 text-[10px] text-gray-400 dark:text-gray-500 font-mono">
            {status === 'online' ? t.execNow : t.execQueued}
          </div>
        </div>

        {/* Queue */}
        <div className="p-3 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              {t.offlineQueue}
            </div>
            {pendingCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-semibold tabular-nums">
                {pendingCount}
              </span>
            )}
          </div>
          {activeJobs.length === 0 ? (
            <div className="flex items-center justify-center flex-1 border border-dashed border-gray-200 dark:border-neutral-700 rounded-lg">
              <span className="text-[10px] text-gray-400 dark:text-gray-600">
                {t.queueEmpty}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1 overflow-y-auto">
              {activeJobs.map((job) => {
                const action = ACTIONS.find((a) => a.key === job.actionKey);
                const jobLabel = action ? action.label : job.actionKey;
                const icon = action?.icon ?? '●';
                const running = job.status === 'running';
                return (
                  <div
                    key={job.id}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-mono transition-all ${
                      running
                        ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40'
                        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                    }`}
                  >
                    <span>{icon}</span>
                    <span className="flex-1 truncate">{jobLabel}</span>
                    <span className="opacity-60">
                      {running ? t.running : t.pending}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Window chrome + tabs + slide
// ---------------------------------------------------------------------------

type Tab = 'status' | 'queue';

function DemoInner({
  lang,
  detector,
}: {
  lang: 'en' | 'ko';
  detector: ManualDetector;
}) {
  const t = T[lang];
  const [tab, setTab] = useState<Tab>('status');
  const [showCode, setShowCode] = useState(false);
  const code = tab === 'status' ? STATUS_CODE : QUEUE_CODE;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden text-sm select-none">
      {/* Chrome */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-400 dark:bg-red-500" />
            <span className="w-3 h-3 rounded-full bg-yellow-400 dark:bg-yellow-500" />
            <span className="w-3 h-3 rounded-full bg-green-400 dark:bg-green-500" />
          </div>
          <div className="flex gap-0.5">
            {(['status', 'queue'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  tab === id
                    ? 'bg-white dark:bg-neutral-700 text-gray-700 dark:text-gray-200 shadow-sm'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                {id === 'status' ? t.tabStatus : t.tabQueue}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCode((v) => !v)}
            className="text-xs px-2.5 py-1 rounded-md font-medium border border-gray-200 dark:border-neutral-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer font-mono"
          >
            {showCode ? t.showDemo : t.showCode}
          </button>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-semibold">
            Live
          </span>
        </div>
      </div>

      {/* Sliding panels — fixed height so code panel doesn't stretch the container */}
      <div className="overflow-hidden" style={{ height: '440px' }}>
        <div
          className="flex h-full"
          style={{
            transform: showCode ? 'translateX(-50%)' : 'translateX(0)',
            width: '200%',
            transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Demo panel */}
          <div style={{ width: '50%' }} className="min-w-0 h-full">
            <div className={tab === 'status' ? 'h-full' : 'hidden'}>
              <StatusDemo lang={lang} detector={detector} />
            </div>
            <div className={tab === 'queue' ? 'h-full' : 'hidden'}>
              <QueueDemo lang={lang} detector={detector} />
            </div>
          </div>

          {/* Code panel */}
          <div style={{ width: '50%' }} className="min-w-0 h-full">
            <SyntaxCode code={code} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

export function ConnectivityDemo({
  lang = 'en',
  showDevTools = false,
}: {
  lang?: 'en' | 'ko';
  showDevTools?: boolean;
}) {
  const detector = useDemoDetector();
  const client = useConnectivityClient();

  if (!detector) {
    return (
      <>
        <Toaster position="bottom-right" richColors />
        <div className="p-5 flex items-center justify-center h-[440px] text-gray-400">
          ConnectivityDemoProvider is required.
        </div>
      </>
    );
  }

  return (
    <>
      <Toaster position="bottom-right" richColors />
      <DemoInner lang={lang} detector={detector} />
      {showDevTools && client && (
        <ConnectivityDevTools client={client} enabled />
      )}
    </>
  );
}
