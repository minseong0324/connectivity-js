import { Head } from 'nextra/components';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'connectivity-js',
  description:
    'Declarative, type-safe, offline-first connectivity management for React.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>{children}</body>
    </html>
  );
}
