import { generateStaticParamsFor, importPage } from 'nextra/pages';

import { useMDXComponents } from '@/mdx-components';

import type { Lang } from '@/types/lang';

export const generateStaticParams = generateStaticParamsFor('mdxPath');

export async function generateMetadata(props: {
  params: Promise<{ mdxPath: string[]; lang: Lang }>;
}) {
  const params = await props.params;
  const { metadata } = await importPage(params.mdxPath, params.lang);
  return metadata;
}

// biome-ignore lint/correctness/useHookAtTopLevel: nextra calls useMDXComponents at module level by design
const Wrapper = useMDXComponents({}).wrapper;

export default async function Page(props: {
  params: Promise<{ mdxPath: string[]; lang: Lang }>;
}) {
  const params = await props.params;
  const result = await importPage(params.mdxPath, params.lang);
  const { default: MDXContent, toc, metadata, sourceCode } = result;

  return (
    <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
      <MDXContent {...props} params={params} />
    </Wrapper>
  );
}
