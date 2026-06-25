import { setRequestLocale } from 'next-intl/server';

import { AdminOrdersView } from '@/components/admin-orders-view';

export default async function AdminOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AdminOrdersView />;
}
