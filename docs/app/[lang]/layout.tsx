import { getPageMap } from 'nextra/page-map';
import { Footer, Layout, LocaleSwitch, Navbar } from 'nextra-theme-docs';

import { ConnectivityDemoProvider } from '@/components/connectivity-demo-provider';
import 'nextra-theme-docs/style.css';
import '../globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | Connectivity',
    default: 'Connectivity | Offline-first connectivity engine',
  },
  description: 'Offline-first connectivity engine for React applications.',
  metadataBase: new URL('https://github.com/minseong0324/connectivity-js'),
  openGraph: {
    title: 'Connectivity',
    description: 'Offline-first connectivity engine for React applications.',
  },
  icons: { icon: '/favicon.ico' },
};

const navbar = (
  <Navbar
    logo={<b className="text-lg font-bold">Connectivity</b>}
    projectLink="https://github.com/minseong0324/connectivity-js"
  >
    <LocaleSwitch />
  </Navbar>
);
const footer = <Footer>MIT {new Date().getFullYear()} © connectivity.</Footer>;

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
