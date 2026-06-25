import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ProductsView } from '@/components/products-view';

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('Products');

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>
      <ProductsView />
    </main>
  );
}
