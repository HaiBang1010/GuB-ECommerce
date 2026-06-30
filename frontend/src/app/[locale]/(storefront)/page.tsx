import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { BannerCarousel } from '@/features/banner/components/banner-carousel';
import { ProductRow } from '@/features/product/components/product-row';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('Home');

  return (
    <>
      <BannerCarousel />

      {/* Themed product rows — each hides itself when empty (Slice 2). */}
      <ProductRow
        title={t('onSaleTitle')}
        params={{ onSale: true, limit: 12 }}
        seeMoreHref="/products"
      />
      <ProductRow
        title={t('newArrivals')}
        params={{ sort: 'new', limit: 12 }}
        seeMoreHref="/products"
      />

      <main className="flex flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold">{t('title')}</h1>
        <Button asChild>
          <Link href="/products">{t('browse')}</Link>
        </Button>
      </main>
    </>
  );
}
