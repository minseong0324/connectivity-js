'use client';

import { useAction, useConnectivity } from '@connectivity-js/react';
import { ConnectivityDevTools } from '@connectivity-js/react-devtools';
import { useRef } from 'react';
import { Toaster, toast } from 'sonner';
import {
  useConnectivityClient,
  useDemoDetector,
} from '@/components/connectivity-demo-provider';

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

const DOC_TITLES = [
  'Meeting Notes',
  'Project Plan',
  'Draft Post',
  'TODO List',
  'Report',
];

function randomTitle() {
  return (
    DOC_TITLES[Math.floor(Math.random() * DOC_TITLES.length)] ?? 'Untitled'
  );
}

function DevToolsDemoInner() {
  const { status } = useConnectivity();
  const detector = useDemoDetector();
  const saveCountRef = useRef(0);

  const saveAction = useAction(
    {
      actionKey: 'devtools-save',
      request: async () => {
        await delay(600);
        return 'ok';
      },
    },
    {
      onSuccess: () => toast.success('Saved!'),
      onEnqueued: () => toast.info('Queued — will send when online'),
    },
  );

  const syncAction = useAction(
    {
      actionKey: 'devtools-sync',
      request: async () => {
        await delay(800);
        return 'ok';
      },
    },
    {
      onSuccess: () => toast.success('Synced!'),
      onEnqueued: () => toast.info('Queued — will send when online'),
    },
  );

  return (
    <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden text-sm select-none">
      {/* Chrome */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400 dark:bg-red-500" />
          <span className="w-3 h-3 rounded-full bg-yellow-400 dark:bg-yellow-500" />
          <span className="w-3 h-3 rounded-full bg-green-400 dark:bg-green-500" />
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-semibold">
          Live
        </span>
      </div>

      <div className="p-5 flex flex-col gap-5" style={{ height: '240px' }}>
        {/* Status row */}
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
              {status === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!detector) {
                return;
              }
              status === 'online'
                ? detector.setOffline()
                : detector.setOnline();
            }}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
              status === 'online'
                ? 'bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-600 dark:text-gray-300'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm'
            }`}
          >
            {status === 'online' ? 'Go Offline' : 'Go Online'}
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">
            Switch to offline, then click the buttons to see the DevTools panel
            (bottom right)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                saveCountRef.current += 1;
                saveAction.execute({
                  docId: saveCountRef.current,
                  title: randomTitle(),
                });
              }}
              className="flex-1 text-xs px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-gray-700 dark:text-gray-300 transition-all cursor-pointer font-medium"
            >
              💾 Save Document
            </button>
            <button
              type="button"
              onClick={() =>
                syncAction.execute({
                  since: Date.now(),
                  keys: ['posts', 'users'],
                })
              }
              className="flex-1 text-xs px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-gray-700 dark:text-gray-300 transition-all cursor-pointer font-medium"
            >
              🔄 Sync Data
            </button>
          </div>
          <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
            {status === 'online'
              ? '→ Executes immediately'
              : '→ Stored in queue, replays when back online'}
          </p>
        </div>
      </div>
    </div>
  );
}

export function DevToolsDemo() {
  const detector = useDemoDetector();
  const client = useConnectivityClient();

  if (!detector) {
    return (
      <>
        <Toaster position="bottom-right" richColors />
        <div
          className="p-5 flex items-center justify-center text-gray-400 rounded-xl border border-gray-200 dark:border-neutral-700"
          style={{ height: '240px' }}
        >
          ConnectivityDemoProvider is required.
        </div>
      </>
    );
  }

  return (
    <>
      <Toaster position="bottom-right" richColors />
      <DevToolsDemoInner />
      {client && <ConnectivityDevTools client={client} enabled />}
    </>
  );
}
