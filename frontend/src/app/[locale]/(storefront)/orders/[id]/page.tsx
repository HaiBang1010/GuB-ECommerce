import { setRequestLocale } from 'next-intl/server';

import { OrderDetailView } from '@/components/order-detail-view';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return <OrderDetailView orderId={id} />;
}
