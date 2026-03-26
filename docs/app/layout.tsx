import type { ReactNode } from 'react';

export const metadata = {
  title: 'connectivity-js',
  description:
    'Declarative, type-safe, offline-first connectivity management for web apps.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
