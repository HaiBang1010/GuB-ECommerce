import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { BannerCarousel } from '@/features/banner/components/banner-carousel';

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
      <main className="flex flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold">{t('title')}</h1>
        <Button asChild>
          <Link href="/products">{t('browse')}</Link>
        </Button>
      </main>
    </>
  );
}
