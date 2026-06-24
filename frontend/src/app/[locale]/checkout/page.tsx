import { setRequestLocale } from 'next-intl/server';

import { CheckoutView } from '@/components/checkout-view';

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <CheckoutView />;
}
