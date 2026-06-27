import { setRequestLocale } from 'next-intl/server';

import { ProductDetailView } from '@/features/product/components/product-detail-view';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  return <ProductDetailView slug={slug} />;
}
