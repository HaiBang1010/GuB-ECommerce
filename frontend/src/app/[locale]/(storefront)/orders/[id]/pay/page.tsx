import { setRequestLocale } from 'next-intl/server';

import { PayView } from '@/features/order/components/pay-view';

export default async function PayPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return <PayView orderId={id} />;
}
