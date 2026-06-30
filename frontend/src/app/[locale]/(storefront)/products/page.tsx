import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ProductsView } from '@/features/product/components/products-view';

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { category } = await searchParams;
  // ?category=<slug> filters the list (set by the home category grid). Arrays (a
  // repeated param) collapse to undefined — we only honour a single slug.
  const categorySlug = typeof category === 'string' ? category : undefined;

  const t = await getTranslations('Products');

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>
      <ProductsView category={categorySlug} />
    </main>
  );
}
