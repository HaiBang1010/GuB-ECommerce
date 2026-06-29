import { setRequestLocale } from 'next-intl/server';

import { OrdersListView } from '@/features/order/components/orders-list-view';

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <OrdersListView />;
}
