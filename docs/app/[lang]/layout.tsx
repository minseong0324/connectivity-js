import { getPageMap } from 'nextra/page-map';
import { Footer, Layout, LocaleSwitch, Navbar } from 'nextra-theme-docs';

import { ConnectivityDemoProvider } from '@/components/connectivity-demo-provider';
import 'nextra-theme-docs/style.css';
import '../globals.css';
import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = {
  title: {
    template: '%s | connectivity-js',
    default:
      'connectivity-js | Declarative, type-safe, offline-first connectivity management for React',
  },
  description:
    'Declarative, type-safe, offline-first connectivity management for React. Auto-queue, deduplication, retry.',
  metadataBase: new URL('https://connectivity-js-docs.vercel.app'),
  openGraph: {
    title: {
      template: '%s | connectivity-js',
      default:
        'connectivity-js | Declarative, type-safe, offline-first connectivity management for React',
    },
    description:
      'Declarative, type-safe, offline-first connectivity management for React.',
    images: ['img/og-webp.webp'],
  },
  icons: { icon: 'img/logo.png' },
};

const navbar = (
  <Navbar
    logo={
      <div className="flex items-center gap-2">
        <Image
          src="/img/logo.png"
          alt="connectivity-js logo"
          width={28}
          height={28}
        />
        <b className="text-lg font-bold">connectivity-js</b>
      </div>
    }
    projectLink="https://github.com/minseong0324/connectivity-js"
  >
    <LocaleSwitch />
  </Navbar>
);
const footer = (
  <Footer>MIT {new Date().getFullYear()} © connectivity-js</Footer>
);

const I18N: { locale: string; name: string }[] = [
  { locale: 'en', name: 'English' },
  { locale: 'ko', name: '한국어' },
];

export default async function LangLayout({
  params,
  children,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const pageMap = await getPageMap(lang);

  return (
    <ConnectivityDemoProvider>
      <Layout
        i18n={I18N}
        navbar={navbar}
        pageMap={pageMap}
        docsRepositoryBase="https://github.com/minseong0324/connectivity-js/tree/main/docs"
        footer={footer}
      >
        {children}
      </Layout>
    </ConnectivityDemoProvider>
  );
}
