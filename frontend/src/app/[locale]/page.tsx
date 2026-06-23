import { getTranslations, setRequestLocale } from 'next-intl/server';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('Home');

  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
    </main>
  );
}
