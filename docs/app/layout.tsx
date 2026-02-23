import { Head } from 'nextra/components';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'connectivity',
  description: 'connectivity documentation',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>{children}</body>
    </html>
  );
}
