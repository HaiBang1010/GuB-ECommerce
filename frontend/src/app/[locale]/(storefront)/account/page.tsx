import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

// Minimal account landing — links to the customer's "my" areas. Profile lands
// here in a later Phase 4 slice; for now just Orders + Vouchers.
export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('account');

  const sections = [
    { href: '/account/orders', title: t('ordersTitle'), desc: t('ordersDesc') },
    {
      href: '/account/vouchers',
      title: t('vouchersTitle'),
      desc: t('vouchersDesc'),
    },
    {
      href: '/account/profile',
      title: t('profileTitle'),
      desc: t('profileDesc'),
    },
  ] as const;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="hover:bg-accent flex h-full flex-col gap-1 rounded-md border p-4 transition-colors"
            >
              <span className="font-medium">{s.title}</span>
              <span className="text-muted-foreground text-sm">{s.desc}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
