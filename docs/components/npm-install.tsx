'use client';

import { useState } from 'react';

export function NpmInstall({
  command = 'npm i @connectivity-js/react',
}: {
  command?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="inline-flex items-center gap-2 pl-4 pr-2 py-2.5 rounded-lg bg-gray-100 dark:bg-neutral-800 text-sm font-mono text-gray-700 dark:text-gray-300">
      <span>{command}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center justify-center w-7 h-7 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
        aria-label="Copy to clipboard"
      >
        {copied ? (
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
}
