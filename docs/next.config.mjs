import nextra from 'nextra';

// Nextra will handle MD/MDX through its loader
const withNextra = nextra({
  // 사이드바 등 페이지맵 링크에 /en, /ko prefix 추가 (i18n)
  unstable_shouldAddLocaleToLinks: true,
});

export default withNextra({
  reactStrictMode: true,
  // 데모·DevTools·hooks가 동일한 ConnectivityClient singleton을 공유하도록
  transpilePackages: [
    '@connectivity/core',
    '@connectivity/react',
    '@connectivity/devtools',
    '@connectivity/react-devtools',
  ],
  i18n: {
    locales: ['en', 'ko'],
    defaultLocale: 'en',
  },
});
